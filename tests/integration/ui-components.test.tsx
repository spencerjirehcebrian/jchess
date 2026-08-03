import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useGameStore, initialGameState } from '../../src/store'
import { GameController } from '../../src/store/controller'
import { StatusBar } from '../../src/ui/StatusBar'
import { DifficultyPicker } from '../../src/ui/DifficultyPicker'
import { GameControls } from '../../src/ui/GameControls'
import { ResultBanner } from '../../src/ui/ResultBanner'
import { SettingsPanel } from '../../src/ui/SettingsPanel'
import { NotationInput } from '../../src/ui/NotationInput'
import { MoveList } from '../../src/ui/MoveList'
import { App } from '../../src/ui/App'

describe('UI Component Integration Tests', () => {
  beforeEach(() => {
    useGameStore.setState(() => ({ ...initialGameState }))
  })

  it('renders StatusBar with current turn message', () => {
    useGameStore.setState(() => ({ status: { kind: 'human-turn' } }))
    render(<StatusBar />)
    expect(screen.getByText('Your move')).toBeTruthy()
  })

  it('renders DifficultyPicker and triggers startNewGame on click', () => {
    const controller = new GameController(useGameStore as any)
    render(<DifficultyPicker controller={controller} />)

    const level1Btn = screen.getByText(/Level 1/)
    expect(level1Btn).toBeTruthy()
    fireEvent.click(level1Btn)

    expect(useGameStore.getState().difficulty).toBe(1)
  })

  it('renders GameControls and executes action handlers', () => {
    const controller = new GameController(useGameStore as any)
    render(<GameControls controller={controller} />)

    const flipBtn = screen.getByText('Flip')
    fireEvent.click(flipBtn)
    expect(useGameStore.getState().boardFlipped).toBe(true)
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

  it('renders SettingsPanel and handles closing', () => {
    let closed = false
    render(<SettingsPanel onClose={() => { closed = true }} />)
    expect(screen.getByText('Settings')).toBeTruthy()

    const closeBtn = screen.getByText('Close')
    fireEvent.click(closeBtn)
    expect(closed).toBe(true)
  })

  it('handles SAN input buffer in NotationInput', () => {
    const controller = new GameController(useGameStore as any)
    useGameStore.setState(() => ({ status: { kind: 'human-turn' } }))
    render(<NotationInput controller={controller} />)

    const input = screen.getByLabelText('Enter move in SAN notation') as HTMLInputElement
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

  it('renders main App layout without crashing', () => {
    const { container } = render(<App />)
    expect(screen.getByText('Voxel Chess')).toBeTruthy()
    expect(container.querySelector('canvas')).toBeTruthy()
  })
})
