import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store'
import { GameController } from '../store/controller'
import { positionAfter, legalMoves, toSan } from '../core/rules'
import { matchPrefix } from '../core/san-parser'

interface NotationInputProps {
  controller: GameController | null
}

export function NotationInput({ controller }: NotationInputProps) {
  const state = useGameStore()
  const [buffer, setBuffer] = useState('')
  const [isShaking, setIsShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const currentPos = positionAfter(
    state.initialFen,
    state.history.slice(0, state.cursor).map((h) => h.move)
  )

  const legals = legalMoves(currentPos)
  const notationState = matchPrefix(buffer, legals, currentPos)

  const isEngineThinking = state.status.kind === 'engine-thinking' || state.status.kind === 'engine-delaying'
  const isPremoveMode = isEngineThinking

  useEffect(() => {
    // Keep focused
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (notationState.exactMatch && controller) {
        const ok = controller.makeMove(notationState.exactMatch)
        if (ok) {
          setBuffer('')
        } else {
          triggerShake()
        }
      } else {
        triggerShake()
      }
    } else if (e.key === 'Escape') {
      if (buffer) {
        setBuffer('')
      } else if (controller) {
        controller.clearPremoves()
        controller.setSelectedSquare(null)
      }
    }
  }

  const triggerShake = () => {
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 220)
  }

  const candidateSans = notationState.candidates.slice(0, 8).map((m) => toSan(currentPos, m))
  const remainingCount = Math.max(0, notationState.candidates.length - 8)

  const chevronColor = notationState.exactMatch
    ? isPremoveMode
      ? 'var(--premove)'
      : 'var(--accent-bright)'
    : 'var(--text-dim)'

  return (
    <div
      style={{
        width: '100%',
        background: 'var(--surface)',
        border: `1px solid ${isShaking ? 'var(--error)' : notationState.exactMatch ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: 'var(--sp-2) var(--sp-4)',
        fontFamily: 'var(--font-mono)',
        animation: isShaking ? 'shake 220ms ease-in-out' : 'none',
        transition: 'border-color var(--dur-fast) ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--size-lg)' }}>
        <span style={{ color: chevronColor, marginRight: 'var(--sp-2)', fontWeight: 'bold' }}>▸</span>
        <input
          ref={inputRef}
          type="text"
          value={buffer}
          onChange={(e) => setBuffer(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Enter move in SAN notation"
          placeholder={isPremoveMode ? 'premove...' : 'e4, Nf3...'}
          style={{
            width: '100%',
            color: isPremoveMode ? 'var(--premove)' : 'var(--text)',
            outline: 'none',
            background: 'transparent'
          }}
        />
      </div>

      {buffer && (
        <div style={{ fontSize: 'var(--size-sm)', color: 'var(--text-dim)', marginTop: 'var(--sp-1)' }}>
          {candidateSans.join('   ')}
          {remainingCount > 0 && <span style={{ color: 'var(--text-faint)' }}> +{remainingCount} more</span>}
          {notationState.ambiguous && (
            <span style={{ color: 'var(--warning)', marginLeft: 'var(--sp-2)' }}>Type file or piece to specify</span>
          )}
        </div>
      )}
    </div>
  )
}
