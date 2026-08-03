import { useState, useEffect } from 'react'
import { useGameStore } from '../store'
import { GameController } from '../store/controller'
import { createStockfishEngine } from '../engine/stockfish'

import { BoardCanvas } from './BoardCanvas'
import { NotationInput } from './NotationInput'
import { MoveList } from './MoveList'
import { DifficultyPicker } from './DifficultyPicker'
import { GameControls } from './GameControls'
import { StatusBar } from './StatusBar'
import { ResultBanner } from './ResultBanner'
import { SettingsPanel } from './SettingsPanel'

export function App() {
  const state = useGameStore()
  const [controller, setController] = useState<GameController | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    const storeObj = useGameStore.getState()
    const engine = createStockfishEngine()
    const ctrl = new GameController(storeObj, engine)
    setController(ctrl)

    engine
      .init()
      .then(() => {
        ctrl.startNewGame()
      })
      .catch((err) => {
        console.error('Engine init error:', err)
      })

    return () => {
      engine.dispose()
    }
  }, [])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        color: 'var(--text)'
      }}
    >
      {/* Header Bar */}
      <header
        style={{
          height: '56px',
          padding: '0 var(--sp-6)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--size-md)',
              letterSpacing: '1px',
              textTransform: 'uppercase'
            }}
          >
            Voxel Chess
          </h1>
          <span style={{ fontSize: 'var(--size-sm)', color: 'var(--text-dim)' }}>
            level {state.difficulty}
          </span>
        </div>

        <button
          onClick={() => setIsSettingsOpen(true)}
          aria-label="Settings"
          style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: 'var(--size-md)' }}
        >
          ⚙
        </button>
      </header>

      {/* Main Layout */}
      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 340px)',
          gap: 'var(--sp-4)',
          padding: 'var(--sp-4)',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        {/* Left Column: Board + NotationInput */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-3)',
            height: '100%',
            overflow: 'hidden'
          }}
        >
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <BoardCanvas controller={controller} />
          </div>

          <NotationInput controller={controller} />
        </div>

        {/* Right Rail: Instrumentation */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-3)',
            height: '100%',
            overflow: 'hidden'
          }}
        >
          <StatusBar />

          {state.status.kind === 'over' && (
            <ResultBanner result={state.status.result} controller={controller} />
          )}

          <MoveList controller={controller} />

          <DifficultyPicker controller={controller} />

          <GameControls
            controller={controller}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </div>
      </main>

      {isSettingsOpen && (
        <SettingsPanel onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  )
}
