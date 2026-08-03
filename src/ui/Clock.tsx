import { useEffect, useState } from 'react'
import { Color } from '../core/types'
import { useGameStore } from '../store'

interface ClockProps {
  color: Color
}

export function Clock({ color }: ClockProps) {
  const clockState = useGameStore((s) => s.clock)
  const [timeMs, setTimeMs] = useState(clockState ? clockState.remaining[color] : 0)

  useEffect(() => {
    if (!clockState) return

    const interval = setInterval(() => {
      let remaining = clockState.remaining[color]
      if (clockState.runningFor === color && clockState.runningSince !== null) {
        const elapsed = performance.now() - clockState.runningSince
        remaining = Math.max(0, remaining - elapsed)
      }
      setTimeMs(remaining)
    }, 100)

    return () => clearInterval(interval)
  }, [clockState, color])

  if (!clockState) return null

  const totalSec = Math.ceil(timeMs / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec}`

  const isRunning = clockState.runningFor === color

  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--size-xl)',
        padding: 'var(--sp-2) var(--sp-3)',
        background: isRunning ? 'var(--surface-raised)' : 'var(--surface)',
        border: `1px solid ${isRunning ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        color: isRunning ? 'var(--text)' : 'var(--text-dim)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <span style={{ fontSize: 'var(--size-xs)', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
        {color}
      </span>
      <span>{timeStr}</span>
    </div>
  )
}
