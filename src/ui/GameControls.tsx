import { GameController } from '../store/controller'

interface GameControlsProps {
  controller: GameController | null
  onOpenSettings?: () => void
}

export function GameControls({ controller, onOpenSettings }: GameControlsProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--sp-2)',
        marginTop: 'var(--sp-2)'
      }}
    >
      <button
        onClick={() => controller?.takeback()}
        style={{
          flex: 1,
          padding: 'var(--sp-2) var(--sp-3)',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: 'var(--text)',
          fontSize: 'var(--size-sm)',
          cursor: 'pointer'
        }}
      >
        Take back
      </button>

      <button
        onClick={() => controller?.flipBoard()}
        style={{
          flex: 1,
          padding: 'var(--sp-2) var(--sp-3)',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: 'var(--text)',
          fontSize: 'var(--size-sm)',
          cursor: 'pointer'
        }}
      >
        Flip
      </button>

      <button
        onClick={() => controller?.startNewGame()}
        style={{
          flex: 1,
          padding: 'var(--sp-2) var(--sp-3)',
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          color: 'var(--text)',
          fontSize: 'var(--size-sm)',
          cursor: 'pointer'
        }}
      >
        New game
      </button>

      {onOpenSettings && (
        <button
          onClick={onOpenSettings}
          aria-label="Open settings"
          style={{
            padding: 'var(--sp-2) var(--sp-3)',
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-dim)',
            fontSize: 'var(--size-sm)',
            cursor: 'pointer'
          }}
        >
          Settings
        </button>
      )}
    </div>
  )
}
