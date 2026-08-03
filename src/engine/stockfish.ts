import {
  Engine,
  EngineCapabilities,
  EngineProgress,
  EngineState,
  SearchBudget,
  SearchResult
} from './types'
import { detectCapabilities } from './capability'
import { parseBestMove, parseInfoLine } from './uci'

export interface StockfishEngineOptions {
  workerFactory?: () => Worker
  capabilities?: EngineCapabilities
}

export function createStockfishEngine(opts?: StockfishEngineOptions): Engine {
  const caps = opts?.capabilities ?? detectCapabilities()
  let currentState: EngineState = 'uninitialised'

  let worker: Worker | null = null
  let pendingResolve: ((res: SearchResult) => void) | null = null
  let pendingReject: ((err: Error) => void) | null = null
  let currentProgressCb: ((p: EngineProgress) => void) | null = null
  let lastProgressTime = 0
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null

  let lastProgressData: Partial<EngineProgress> = {}

  function post(cmd: string) {
    if (worker) {
      worker.postMessage(cmd)
    }
  }

  function handleMessage(msgText: string) {
    if (currentState === 'dead') return

    if (msgText.startsWith('info')) {
      const parsed = parseInfoLine(msgText)
      if (parsed) {
        lastProgressData = { ...lastProgressData, ...parsed }
        const now = performance.now()
        if (currentProgressCb && now - lastProgressTime >= 100) {
          lastProgressTime = now
          currentProgressCb({
            depth: lastProgressData.depth ?? 0,
            nodes: lastProgressData.nodes ?? 0,
            nps: lastProgressData.nps ?? 0,
            scoreCp: lastProgressData.scoreCp,
            scoreMate: lastProgressData.scoreMate,
            pv: lastProgressData.pv
          })
        }
      }
      return
    }

    if (msgText.startsWith('bestmove')) {
      if (watchdogTimer !== null) {
        clearTimeout(watchdogTimer)
        watchdogTimer = null
      }

      const res = parseBestMove(msgText)
      const resolve = pendingResolve
      const reject = pendingReject
      pendingResolve = null
      pendingReject = null
      currentProgressCb = null

      if (currentState === 'stopping' || currentState === 'searching') {
        currentState = 'ready'
      }

      if (!res) {
        if (reject) reject(new Error(`Illegal engine output: ${msgText}`))
      } else {
        res.depth = lastProgressData.depth ?? 0
        res.scoreCp = lastProgressData.scoreCp
        res.scoreMate = lastProgressData.scoreMate
        if (resolve) resolve(res)
      }
    }
  }

  function sendCommandWaitResponse(
    cmd: string,
    expectedResponsePrefix: string,
    timeoutMs: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null

      const handler = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : String(e.data)
        if (line.startsWith(expectedResponsePrefix)) {
          if (timer !== null) clearTimeout(timer)
          if (worker) worker.removeEventListener('message', handler)
          resolve(line)
        }
      }

      if (worker) {
        worker.addEventListener('message', handler)
      }

      timer = setTimeout(() => {
        if (worker) worker.removeEventListener('message', handler)
        reject(new Error(`Engine handshake timeout waiting for ${expectedResponsePrefix}`))
      }, timeoutMs)

      post(cmd)
    })
  }

  const engine: Engine = {
    get capabilities() {
      return caps
    },
    get state() {
      return currentState
    },

    async init(): Promise<void> {
      if (currentState !== 'uninitialised') return

      if (opts?.workerFactory) {
        worker = opts.workerFactory()
      } else {
        const workerPath =
          caps.flavor === 'lite-multi'
            ? '/engine/stockfish-18-lite.js'
            : '/engine/stockfish-18-lite-single.js'
        worker = new Worker(workerPath)
      }

      worker.onmessage = (e: MessageEvent) => {
        const line = typeof e.data === 'string' ? e.data : String(e.data)
        handleMessage(line)
      }

      try {
        await sendCommandWaitResponse('uci', 'uciok', 15000)
        post(`setoption name Threads value ${caps.maxThreads}`)
        post('setoption name Hash value 64')
        post('setoption name UCI_ShowWDL value false')
        await sendCommandWaitResponse('isready', 'readyok', 10000)
        currentState = 'ready'
      } catch (err) {
        currentState = 'dead'
        if (worker) {
          worker.terminate()
          worker = null
        }
        throw err
      }
    },

    async setOptions(options: Record<string, string | number | boolean>): Promise<void> {
      if (currentState === 'dead') throw new Error('Engine is dead')
      if (currentState === 'searching') {
        engine.stop()
        await new Promise((r) => setTimeout(r, 50))
      }

      for (const [key, val] of Object.entries(options)) {
        post(`setoption name ${key} value ${val}`)
      }
      await sendCommandWaitResponse('isready', 'readyok', 10000)
    },

    async search(
      fen: string,
      moves: string[],
      budget: SearchBudget,
      searchOpts?: {
        signal?: AbortSignal
        onProgress?: (p: EngineProgress) => void
      }
    ): Promise<SearchResult> {
      if (currentState === 'dead') throw new Error('Engine is dead')

      if (currentState === 'searching') {
        engine.stop()
        if (pendingReject) {
          pendingReject(new Error('Search cancelled by new search'))
        }
        await new Promise((r) => setTimeout(r, 50))
      }

      currentState = 'searching'
      lastProgressData = {}
      currentProgressCb = searchOpts?.onProgress ?? null

      return new Promise<SearchResult>((resolve, reject) => {
        pendingResolve = resolve
        pendingReject = reject

        if (searchOpts?.signal) {
          searchOpts.signal.addEventListener('abort', () => {
            engine.stop()
            reject(new Error('Search aborted'))
          })
        }

        const moveStr = moves.length > 0 ? ` moves ${moves.join(' ')}` : ''
        post(`position fen ${fen}${moveStr}`)

        let goCmd = 'go'
        if (budget.depth !== undefined) goCmd += ` depth ${budget.depth}`
        if (budget.nodes !== undefined) goCmd += ` nodes ${budget.nodes}`
        if (budget.movetime !== undefined) goCmd += ` movetime ${budget.movetime}`
        post(goCmd)

        const timeoutMs = Math.max(budget.movetime ?? 0, 5000) * 5 + 5000
        watchdogTimer = setTimeout(() => {
          currentState = 'dead'
          if (worker) {
            worker.terminate()
            worker = null
          }
          if (pendingReject) {
            pendingReject(new Error('Watchdog: Stockfish engine timed out'))
          }
        }, timeoutMs)
      })
    },

    stop(): void {
      if (currentState === 'searching') {
        currentState = 'stopping'
        post('stop')
      }
    },

    dispose(): void {
      currentState = 'dead'
      if (worker) {
        worker.terminate()
        worker = null
      }
    }
  }

  return engine
}
