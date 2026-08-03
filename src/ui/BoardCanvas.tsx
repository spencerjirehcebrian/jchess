import { useEffect, useRef } from 'react'
import { Renderer } from '../render'
import { useGameStore } from '../store'
import { GameController } from '../store/controller'
import { legalMovesFrom, positionAfter } from '../core/rules'

interface BoardCanvasProps {
  controller: GameController | null
}

export function BoardCanvas({ controller }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<Renderer | null>(null)
  const store = useGameStore()

  useEffect(() => {
    if (!canvasRef.current) return

    const renderer = new Renderer(canvasRef.current)
    rendererRef.current = renderer
    renderer.mount()

    const detach = renderer.attach(store)

    renderer.onSquarePointerDown = (square) => {
      if (!controller) return

      const currentState = useGameStore.getState()
      const currentPos = positionAfter(
        currentState.initialFen,
        currentState.history.slice(0, currentState.cursor).map((h) => h.move)
      )

      if (currentState.selectedSquare === null) {
        const piece = currentPos.board.get(square)
        if (piece && piece.color === currentPos.turn) {
          controller.setSelectedSquare(square)
        }
      } else {
        if (currentState.selectedSquare === square) {
          controller.setSelectedSquare(null)
          return
        }

        const legals = legalMovesFrom(currentPos, currentState.selectedSquare)
        const targetMove = legals.find((m) => m.to === square)

        if (targetMove) {
          controller.makeMove(targetMove)
          controller.setSelectedSquare(null)
        } else {
          const piece = currentPos.board.get(square)
          if (piece && piece.color === currentPos.turn) {
            controller.setSelectedSquare(square)
          } else {
            controller.setSelectedSquare(null)
          }
        }
      }
    }

    return () => {
      detach()
      renderer.dispose()
    }
  }, [controller])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <canvas
        ref={canvasRef}
        aria-label="Chess board view"
        style={{ width: '100%', height: '100%', maxHeight: '720px', maxWidth: '720px', display: 'block' }}
      />
    </div>
  )
}
