import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useGameStore, initialGameState } from '../../src/store'
import { GameController } from '../../src/store/controller'
import { PlayerRow } from '../../src/ui/PlayerRow'
import { DifficultyPicker } from '../../src/ui/DifficultyPicker'
import { GameControls } from '../../src/ui/GameControls'
import { ResultBanner } from '../../src/ui/ResultBanner'
import { SettingsPanel } from '../../src/ui/SettingsPanel'
import { NotationInput } from '../../src/ui/NotationInput'
import { MoveList } from '../../src/ui/MoveList'
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

  it('renders the difficulty ladder and starts a new game on a rung', () => {
    const controller = new GameController(useGameStore as any)
    render(<DifficultyPicker controller={controller} />)

    const rung = screen.getByLabelText(/^Level 1,/)
    fireEvent.click(rung)

    expect(useGameStore.getState().difficulty).toBe(1)
    expect(rung.getAttribute('aria-pressed')).toBe('true')
  })

  it('renders GameControls and executes action handlers', () => {
    const controller = new GameController(useGameStore as any)
    render(<GameControls controller={controller} />)

    const flipBtn = screen.getByText('Flip board')
    fireEvent.click(flipBtn)
    expect(useGameStore.getState().boardFlipped).toBe(true)
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

  it('renders ResultBanner when game is over', () => {
    const controller = new GameController(useGameStore as any)
    render(
      <ResultBanner
        result={{ winner: 'white', reason: 'checkmate' }}
        controller={controller}
      />
    )
    expect(screen.getByText('WHITE WINS')).toBeTruthy()
    expect(screen.getByText('by checkmate')).toBeTruthy()
  })

  it('renders SettingsPanel and handles theme selection and closing', () => {
    let closed = false
    const controller = new GameController(useGameStore as any)
    render(<SettingsPanel controller={controller} onClose={() => { closed = true }} />)
    expect(screen.getByText('Settings')).toBeTruthy()

    const themeSelect = screen.getByLabelText('Theme') as HTMLSelectElement
    fireEvent.change(themeSelect, { target: { value: 'forest' } })
    expect(useGameStore.getState().theme).toBe('forest')

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
