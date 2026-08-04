import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useGameStore, initialGameState } from '../../src/store'
import { GameController } from '../../src/store/controller'
import { PlayerRow } from '../../src/ui/PlayerRow'
import { DifficultyPicker } from '../../src/ui/DifficultyPicker'
import { GameControls } from '../../src/ui/GameControls'
import { ResultOverlay } from '../../src/ui/ResultOverlay'
import { SettingsPanel } from '../../src/ui/SettingsPanel'
import { SetupPanel } from '../../src/ui/SetupPanel'
import { NotationInput } from '../../src/ui/NotationInput'
import { MoveList } from '../../src/ui/MoveList'
import { EvalStrip } from '../../src/ui/EvalStrip'
import { BoardSizeControls } from '../../src/ui/BoardSizeControls'
import { App } from '../../src/ui/App'
import { PromotionPicker } from '../../src/ui/PromotionPicker'
import { selectPointerTarget } from '../../src/ui/BoardCanvas'
import { positionFromFen, legalMovesFrom } from '../../src/core/rules'

describe('UI Component Integration Tests', () => {
  beforeEach(() => {
    useGameStore.setState(() => ({ ...initialGameState }))
  })

  it('addresses turn status to the human player row', () => {
    useGameStore.setState(() => ({ status: { kind: 'human-turn' } }))
    render(<PlayerRow side="human" />)
    expect(screen.getByText('Your move')).toBeTruthy()
  })

  it('reports engine search state on the engine player row', () => {
    useGameStore.setState(() => ({ status: { kind: 'engine-thinking', startedAt: 0 } }))
    render(<PlayerRow side="engine" />)
    expect(screen.getByText('Thinking')).toBeTruthy()
    // "Your move" belongs to the other side and must not appear on this one.
    expect(screen.queryByText('Your move')).toBeNull()
  })

  /*
   * The check legend belongs to whichever side has to answer it, so both rows
   * are asserted from the same state — one showing it, one not. Checking only
   * that it appears somewhere would pass just as well with it lit on both.
   */
  const checkingPly = {
    move: { from: 0, to: 1 },
    san: 'Qh5+',
    fenAfter: '',
    isCheck: true,
    isMate: false,
  }

  it('lights the check legend on the side that has to answer it', () => {
    useGameStore.setState(() => ({
      status: { kind: 'human-turn' },
      history: [checkingPly] as any,
      cursor: 1,
    }))
    render(<PlayerRow side="human" />)
    expect(screen.getByText('Check')).toBeTruthy()
  })

  it('leaves the check legend dark on the side that gave it', () => {
    useGameStore.setState(() => ({
      status: { kind: 'human-turn' },
      history: [checkingPly] as any,
      cursor: 1,
    }))
    render(<PlayerRow side="engine" />)
    expect(screen.queryByText('Check')).toBeNull()
  })

  it('does not report check once it is mate', () => {
    // The game is over and the result plate says so; a check legend under it
    // would be reporting the position one move before the end.
    useGameStore.setState(() => ({
      status: { kind: 'human-turn' },
      history: [{ ...checkingPly, san: 'Qxf7#', isMate: true }] as any,
      cursor: 1,
    }))
    render(<PlayerRow side="human" />)
    expect(screen.queryByText('Check')).toBeNull()
  })

  describe('the evaluation readout', () => {
    const ply = (san: string, evalCp?: number, evalMate?: number) => ({
      move: { from: 0, to: 1 },
      san,
      fenAfter: '',
      isCheck: false,
      isMate: false,
      ...(evalCp !== undefined ? { evalCp } : {}),
      ...(evalMate !== undefined ? { evalMate } : {}),
    })

    // White plays, the engine answers and its search is what carries a score.
    const played = [ply('e4'), ply('e5', 30), ply('Nf3'), ply('Nc6', 250)]

    const setGame = (over: boolean, cursor = played.length) =>
      useGameStore.setState(() => ({
        history: played as any,
        cursor,
        status: over
          ? { kind: 'over', result: { winner: 'white', reason: 'resignation' } }
          : { kind: 'human-turn' },
      }))

    /*
     * The whole point of the feature: knowing you are losing before you can see
     * why is discouraging rather than instructive, so nothing is shown until the
     * game is decided — even though the scores are already recorded.
     */
    it('stays dark while the game is still being played', () => {
      setGame(false)
      const { container } = render(<EvalStrip />)
      expect(container.firstChild).toBeNull()
    })

    it('appears once the game is over', () => {
      setGame(true)
      render(<EvalStrip />)
      expect(screen.getByLabelText(/White ahead by 2.5 pawns/)).toBeTruthy()
    })

    it('reads at the cursor, so stepping back walks the assessment back', () => {
      // Two plies in, the engine's only score so far was +0.30.
      setGame(true, 2)
      render(<EvalStrip />)
      expect(screen.getByLabelText(/White ahead by 0.3 pawns/)).toBeTruthy()
    })

    /*
     * Scores are stored white-positive, so a negative one has to come out as
     * Black — the sign is the one thing here that fails silently.
     */
    it('names Black when the score is negative', () => {
      useGameStore.setState(() => ({
        history: [ply('e4'), ply('e5', -180)] as any,
        cursor: 2,
        status: { kind: 'over', result: { winner: 'black', reason: 'resignation' } },
      }))
      render(<EvalStrip />)
      expect(screen.getByLabelText(/Black ahead by 1.8 pawns/)).toBeTruthy()
    })

    it('pins to mate rather than treating it as a quantity', () => {
      useGameStore.setState(() => ({
        history: [ply('e4'), ply('e5', undefined, 3)] as any,
        cursor: 2,
        status: { kind: 'over', result: { winner: 'white', reason: 'checkmate' } },
      }))
      render(<EvalStrip />)
      expect(screen.getByLabelText(/White mates in 3/)).toBeTruthy()
    })

    it('shows nothing for a game with no engine ply to report on', () => {
      useGameStore.setState(() => ({
        history: [ply('e4')] as any,
        cursor: 1,
        status: { kind: 'over', result: { winner: 'black', reason: 'resignation' } },
      }))
      const { container } = render(<EvalStrip />)
      expect(container.firstChild).toBeNull()
    })

    it('holds the transcript score column back until the game is over', () => {
      setGame(false)
      const { rerender } = render(<MoveList controller={null} />)
      expect(screen.queryByText('+2.5')).toBeNull()

      setGame(true)
      rerender(<MoveList controller={null} />)
      expect(screen.getByText('+2.5')).toBeTruthy()
    })
  })

  /*
   * The ladder used to start a fresh game on every rung press. It only exists
   * in setup now, where there is no game to restart — the choice is taken by
   * the Start key.
   */
  it('sets the pending level on a rung without starting a game', () => {
    const controller = new GameController(useGameStore as any)
    render(<DifficultyPicker controller={controller} />)

    const rung = screen.getByLabelText(/^Level 1,/)
    fireEvent.click(rung)

    expect(useGameStore.getState().difficulty).toBe(1)
    expect(rung.getAttribute('aria-pressed')).toBe('true')
    expect(useGameStore.getState().status.kind).toBe('setup')
    expect(useGameStore.getState().history.length).toBe(0)
  })

  describe('the setup panel', () => {
    it('turns the board around when a side is chosen', () => {
      const controller = new GameController(useGameStore as any)
      render(<SetupPanel controller={controller} />)

      fireEvent.click(screen.getByRole('button', { name: /^Black$/i }))

      expect(useGameStore.getState().colorChoice).toBe('black')
      expect(useGameStore.getState().humanColor).toBe('black')
      expect(useGameStore.getState().boardFlipped).toBe(true)
    })

    it('keeps the board white-side-down for a side not yet drawn', () => {
      const controller = new GameController(useGameStore as any)
      render(<SetupPanel controller={controller} />)

      fireEvent.click(screen.getByRole('button', { name: /^Random$/i }))

      expect(useGameStore.getState().colorChoice).toBe('random')
      expect(useGameStore.getState().boardFlipped).toBe(false)
    })

    // Time control moved off the settings dialog: it shapes the next game, so
    // it belongs with the other choices the Start key consumes.
    it('chooses the time control for the game about to start', () => {
      const controller = new GameController(useGameStore as any)
      render(<SetupPanel controller={controller} />)

      const timeSelect = screen.getByLabelText('Time control') as HTMLSelectElement
      fireEvent.change(timeSelect, { target: { value: '3+2' } })

      expect(useGameStore.getState().timeControlId).toBe('3+2')
      // Still nothing running — the clock is created by the game, not the panel.
      expect(useGameStore.getState().clock).toBeUndefined()
    })
  })

  it('renders GameControls and executes action handlers', () => {
    const controller = new GameController(useGameStore as any)
    render(<GameControls controller={controller} />)

    const flipBtn = screen.getByText('Flip board')
    fireEvent.click(flipBtn)
    expect(useGameStore.getState().boardFlipped).toBe(true)
  })

  /*
   * One key at the bottom of the plate carries the machine between its states,
   * so the two irreversible ones can never be pressed by mistake for each
   * other: Resign and New game are never on screen at the same time.
   */
  describe('the state key', () => {
    it('offers Start game, and only Start game, before a game exists', () => {
      const controller = new GameController(useGameStore as any)
      render(<GameControls controller={controller} />)

      expect(screen.queryByRole('button', { name: /^Resign$/i })).toBeNull()
      expect(screen.queryByRole('button', { name: /^New game$/i })).toBeNull()
      // Nothing to take back or hint about either.
      expect(screen.queryByText('Take back')).toBeNull()

      fireEvent.click(screen.getByRole('button', { name: /^Start game$/i }))
      expect(useGameStore.getState().status.kind).toBe('human-turn')
      controller.dispose()
    })

    it('offers Resign, and only Resign, while a game is on', () => {
      const controller = new GameController(useGameStore as any)
      useGameStore.setState(() => ({ status: { kind: 'human-turn' } }))
      render(<GameControls controller={controller} />)

      expect(screen.getByRole('button', { name: /^Resign$/i })).toBeTruthy()
      expect(screen.queryByRole('button', { name: /^New game$/i })).toBeNull()
      expect(screen.queryByRole('button', { name: /^Start game$/i })).toBeNull()
    })

    it('puts a finished game away rather than starting another', () => {
      const controller = new GameController(useGameStore as any)
      useGameStore.setState(() => ({
        status: { kind: 'over', result: { winner: 'black', reason: 'resignation' } },
        difficulty: 5,
        timeControlId: '3+2',
        history: [
          { move: { from: 12, to: 28 }, san: 'e4', fenAfter: '...', isCheck: false, isMate: false }
        ],
        cursor: 1
      }))
      render(<GameControls controller={controller} />)

      expect(screen.queryByRole('button', { name: /^Resign$/i })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: /^New game$/i }))

      // Back to the panel, not into another game — and it comes back filled in.
      expect(useGameStore.getState().status.kind).toBe('setup')
      expect(useGameStore.getState().history.length).toBe(0)
      expect(useGameStore.getState().difficulty).toBe(5)
      expect(useGameStore.getState().timeControlId).toBe('3+2')
    })
  })

  /*
   * Resigning is irreversible and sits on the same plate as the key that starts
   * a new game, so it takes two presses. The first must not end anything.
   */
  describe('the resign key', () => {
    it('arms on the first press without ending the game', () => {
      const controller = new GameController(useGameStore as any)
      useGameStore.setState(() => ({ status: { kind: 'human-turn' } }))
      render(<GameControls controller={controller} />)

      fireEvent.click(screen.getByRole('button', { name: /^Resign$/i }))

      expect(useGameStore.getState().status.kind).toBe('human-turn')
      // The word changes, so the state is carried by the accessible name and
      // not by colour alone.
      expect(screen.getByRole('button', { name: /^Resign\?$/i })).toBeTruthy()
    })

    it('resigns on the second press', () => {
      const controller = new GameController(useGameStore as any)
      useGameStore.setState(() => ({ status: { kind: 'human-turn' }, humanColor: 'white' }))
      render(<GameControls controller={controller} />)

      fireEvent.click(screen.getByRole('button', { name: /^Resign$/i }))
      fireEvent.click(screen.getByRole('button', { name: /^Resign\?$/i }))

      const status = useGameStore.getState().status as any
      expect(status.kind).toBe('over')
      expect(status.result.reason).toBe('resignation')
      // You lose the game you resign.
      expect(status.result.winner).toBe('black')
    })

    it('disarms when another key on the plate is used', () => {
      const controller = new GameController(useGameStore as any)
      useGameStore.setState(() => ({ status: { kind: 'human-turn' } }))
      render(<GameControls controller={controller} />)

      fireEvent.click(screen.getByRole('button', { name: /^Resign$/i }))
      fireEvent.click(screen.getByRole('button', { name: /^Flip board$/i }))

      // Back to asking, so a half-pressed resign is never left waiting to be
      // completed by an unrelated click later on.
      expect(screen.getByRole('button', { name: /^Resign$/i })).toBeTruthy()
      expect(useGameStore.getState().status.kind).toBe('human-turn')
    })
  })

  it('disables Take back until there is a human ply to undo', () => {
    const controller = new GameController(useGameStore as any)
    useGameStore.setState(() => ({ status: { kind: 'human-turn' }, history: [] }))

    const { rerender } = render(<GameControls controller={controller} />)
    const takebackBtn = screen.getByText('Take back').closest('button') as HTMLButtonElement
    expect(takebackBtn.disabled).toBe(true)

    act(() => {
      useGameStore.setState(() => ({
        history: [
          { move: { from: 12, to: 28 }, san: 'e4', fenAfter: '...', isCheck: false, isMate: false }
        ],
        cursor: 1,
        status: { kind: 'engine-thinking', startedAt: Date.now() }
      }))
    })
    rerender(<GameControls controller={controller} />)
    expect((screen.getByText('Take back').closest('button') as HTMLButtonElement).disabled).toBe(false)
  })

  it('asks which piece to promote instead of silently auto-queening', () => {
    // legalMovesFrom emits queen first, so taking the first candidate would
    // always queen. A pawn push to the last rank must open the picker instead.
    const pos = positionFromFen('7k/4P3/8/8/8/8/8/4K3 w - - 0 1')
    const e7 = 52
    const e8 = 60
    const candidates = legalMovesFrom(pos, e7)

    expect(selectPointerTarget(candidates, e8)).toEqual({ kind: 'promotion' })
    // A non-promotion destination still commits straight away.
    const kingMoves = legalMovesFrom(pos, 4)
    expect(selectPointerTarget(kingMoves, 3)).toEqual({
      kind: 'move',
      move: { from: 4, to: 3 }
    })
    expect(selectPointerTarget(candidates, 0)).toEqual({ kind: 'none' })
  })

  it('commits the chosen promotion piece from the picker', () => {
    const chosen: string[] = []
    render(
      <PromotionPicker
        color="white"
        anchor={{ x: 0, y: 0 }}
        onSelect={(role) => chosen.push(role)}
        onCancel={() => chosen.push('cancel')}
      />
    )

    expect(screen.getByLabelText('Choose promotion piece')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Promote to knight'))
    expect(chosen).toEqual(['knight'])

    fireEvent.keyDown(window, { key: 'r' })
    expect(chosen).toEqual(['knight', 'rook'])

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(chosen).toEqual(['knight', 'rook', 'cancel'])
  })

  /*
   * The result is reported from where the player is sitting. "White wins" is a
   * fact about a board; which of the two people it happened to is the thing
   * being announced — and it is the only phrasing that survives picking a side
   * at random.
   */
  describe('the result overlay', () => {
    it('tells the winner they won', () => {
      render(
        <ResultOverlay
          result={{ winner: 'white', reason: 'checkmate' }}
          humanColor="white"
          onDismiss={() => {}}
        />
      )
      expect(screen.getByText('YOU WON')).toBeTruthy()
      expect(screen.getByText('by checkmate')).toBeTruthy()
    })

    it('tells the loser they lost, on the same result', () => {
      render(
        <ResultOverlay
          result={{ winner: 'white', reason: 'checkmate' }}
          humanColor="black"
          onDismiss={() => {}}
        />
      )
      expect(screen.getByText('YOU LOST')).toBeTruthy()
    })

    it('takes no side on a draw', () => {
      render(
        <ResultOverlay
          result={{ winner: null, reason: 'stalemate' }}
          humanColor="white"
          onDismiss={() => {}}
        />
      )
      expect(screen.getByText('DRAW')).toBeTruthy()
      expect(screen.getByText('by stalemate')).toBeTruthy()
    })

    it('says how a flag fall ended it in words, not jargon', () => {
      render(
        <ResultOverlay
          result={{ winner: 'black', reason: 'timeout' }}
          humanColor="white"
          onDismiss={() => {}}
        />
      )
      expect(screen.getByText('on time')).toBeTruthy()
    })

    // Every way out leads to the same place: the game, still there, uncovered.
    it('gets out of the way on the key, on Escape, and on the surround', () => {
      let dismissed = 0
      const props = {
        result: { winner: 'white', reason: 'checkmate' } as const,
        humanColor: 'white' as const,
        onDismiss: () => { dismissed += 1 }
      }

      const { unmount } = render(<ResultOverlay {...props} />)
      fireEvent.click(screen.getByRole('button', { name: /View game/i }))
      expect(dismissed).toBe(1)
      unmount()

      const second = render(<ResultOverlay {...props} />)
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(dismissed).toBe(2)
      second.unmount()

      render(<ResultOverlay {...props} />)
      fireEvent.click(screen.getByRole('dialog'))
      expect(dismissed).toBe(3)
    })
  })

  it('renders SettingsPanel and handles theme selection and closing', () => {
    let closed = false
    const controller = new GameController(useGameStore as any)
    render(<SettingsPanel controller={controller} onClose={() => { closed = true }} />)
    expect(screen.getByText('Settings')).toBeTruthy()

    const themeSelect = screen.getByLabelText('Theme') as HTMLSelectElement
    fireEvent.change(themeSelect, { target: { value: 'forest' } })
    expect(useGameStore.getState().theme).toBe('forest')

    // Time control is not here any more: it shapes a game rather than the
    // machine, so it lives on the setup panel with the other pre-game choices.
    expect(screen.queryByLabelText('Time control')).toBeNull()

    const closeBtn = screen.getByText('Close')
    fireEvent.click(closeBtn)
    expect(closed).toBe(true)
  })

  it('handles SAN input buffer in NotationInput', () => {
    const controller = new GameController(useGameStore as any)
    useGameStore.setState(() => ({ status: { kind: 'human-turn' } }))
    render(<NotationInput controller={controller} />)

    const input = screen.getByLabelText('Enter move in algebraic notation') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'e4' } })
    expect(input.value).toBe('e4')

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    expect(useGameStore.getState().history.length).toBe(1)
  })

  /*
   * The typed first move is the same implicit start as the dragged one — and
   * it is only white's to make. For a side that has not moved first, or has
   * not been drawn yet, the slot is switched off rather than left offering
   * moves that would be refused.
   */
  it('starts the game on a typed first move as white', () => {
    const controller = new GameController(useGameStore as any)
    render(<NotationInput controller={controller} />)

    const input = screen.getByLabelText('Enter move in algebraic notation') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'e4' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(useGameStore.getState().history.length).toBe(1)
    expect(useGameStore.getState().status.kind).toBe('engine-thinking')
    controller.dispose()
  })

  it('switches the notation slot off in setup for a side that cannot move', () => {
    const controller = new GameController(useGameStore as any)
    controller.setColorChoice('black')
    render(<NotationInput controller={controller} />)

    const input = screen.getByLabelText('Enter move in algebraic notation') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(screen.getByText('press start')).toBeTruthy()
    // And it offers nothing: those moves belong to a board it cannot move on.
    expect(screen.queryByText('e4')).toBeNull()
  })

  it('switches the notation slot off once the game is over', () => {
    const controller = new GameController(useGameStore as any)
    useGameStore.setState(() => ({
      status: { kind: 'over', result: { winner: 'black', reason: 'resignation' } }
    }))
    render(<NotationInput controller={controller} />)

    const input = screen.getByLabelText('Enter move in algebraic notation') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(screen.getByText('game over')).toBeTruthy()
  })

  it('renders MoveList and navigates history cursor', () => {
    const controller = new GameController(useGameStore as any)
    useGameStore.setState(() => ({
      history: [
        { move: { from: 12, to: 28 }, san: 'e4', fenAfter: '...', isCheck: false, isMate: false },
        { move: { from: 52, to: 36 }, san: 'e5', fenAfter: '...', isCheck: false, isMate: false }
      ],
      cursor: 2
    }))

    render(<MoveList controller={controller} />)
    const e4Btn = screen.getByText('e4')
    expect(e4Btn).toBeTruthy()

    fireEvent.click(e4Btn)
    expect(useGameStore.getState().cursor).toBe(1)
  })

  it('renders BoardSizeControls and increases/decreases board size', () => {
    const controller = new GameController(useGameStore as any)
    render(<BoardSizeControls controller={controller} />)

    expect(screen.getByText('Size')).toBeTruthy()

    // The segmented group and maximise toggle were replaced by a plain
    // stepper, so size now moves one rung at a time in either direction.
    const decBtn = screen.getByLabelText('Make the board smaller')
    const incBtn = screen.getByLabelText('Make the board larger')

    fireEvent.click(decBtn)
    expect(useGameStore.getState().boardSize).toBe('large')

    fireEvent.click(decBtn)
    expect(useGameStore.getState().boardSize).toBe('normal')

    fireEvent.click(incBtn)
    expect(useGameStore.getState().boardSize).toBe('large')
  })

  it('renders main App layout without crashing', async () => {
    let container: HTMLElement
    await act(async () => {
      const res = render(<App />)
      container = res.container
    })
    expect(screen.getByText('jchess')).toBeTruthy()
    expect(container!.querySelector('canvas')).toBeTruthy()
  })
})
