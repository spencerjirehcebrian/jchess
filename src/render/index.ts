import * as THREE from 'three'
import { Theme, THEMES } from './voxel/palette'
import { createScene } from './scene'
import { PieceManager } from './pieces'
import { OverlayManager } from './overlay'
import { raycastToSquare } from './picking'
import { AnimationEngine } from './animation/engine'
import { Square } from '../core/types'
import { Store } from '../store'
import { positionAfter, legalMovesFrom } from '../core/rules'

export class Renderer {
  private canvas: HTMLCanvasElement
  private theme: Theme
  private webglRenderer: THREE.WebGLRenderer
  private camera: THREE.OrthographicCamera
  private scene: THREE.Scene
  private pieceManager: PieceManager
  private overlayManager: OverlayManager
  private animEngine = new AnimationEngine()
  private raycaster = new THREE.Raycaster()

  private dirty = true
  private rafHandle: number | null = null
  private boardFlipped = false
  private resizeObserver: ResizeObserver | null = null
  private hoveredSquare: Square | null = null

  public onSquarePointerDown?: (square: Square, event: PointerEvent) => void
  public onSquarePointerUp?: (square: Square, event: PointerEvent) => void
  public onSquareHover?: (square: Square | null) => void

  constructor(canvas: HTMLCanvasElement, theme?: Theme) {
    this.canvas = canvas
    this.theme = theme ?? THEMES.oxide!

    this.webglRenderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    })
    this.webglRenderer.shadowMap.enabled = true
    this.webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const { scene, camera } = createScene(this.theme)
    this.scene = scene
    this.camera = camera

    this.pieceManager = new PieceManager(this.theme)
    this.scene.add(this.pieceManager.piecesGroup)
    this.scene.add(this.pieceManager.shadowQuadsGroup)

    this.overlayManager = new OverlayManager(this.theme)
    this.scene.add(this.overlayManager.group)

    this.handlePointerDown = this.handlePointerDown.bind(this)
    this.handlePointerUp = this.handlePointerUp.bind(this)
    this.handlePointerMove = this.handlePointerMove.bind(this)
  }

  mount(): void {
    this.resize()

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.canvas.parentElement || document.body)

    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    this.canvas.addEventListener('pointerup', this.handlePointerUp)
    this.canvas.addEventListener('pointermove', this.handlePointerMove)

    this.requestRender()
  }

  dispose(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle)
      this.rafHandle = null
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
      this.resizeObserver = null
    }

    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)

    this.webglRenderer.dispose()
  }

  attach(store: Store): () => void {
    const updateFromStore = (state: Store) => {
      this.boardFlipped = state.boardFlipped

      const historyToRender = state.history.slice(0, state.cursor)
      const currentPos = positionAfter(
        state.initialFen,
        historyToRender.map((h) => h.move)
      )

      this.pieceManager.updatePosition(currentPos, this.boardFlipped)

      // Update overlays
      const lastEntry = historyToRender[historyToRender.length - 1]
      if (lastEntry) {
        this.overlayManager.setLastMove(
          lastEntry.move.from,
          lastEntry.move.to,
          this.boardFlipped
        )
      } else {
        this.overlayManager.setLastMove(null, null, this.boardFlipped)
      }

      this.overlayManager.setSelectedSquare(state.selectedSquare, this.boardFlipped)

      if (state.selectedSquare !== null) {
        const legals = legalMovesFrom(currentPos, state.selectedSquare)
        this.overlayManager.setLegalMoveDots(
          legals.map((m) => m.to),
          this.boardFlipped
        )
      } else {
        this.overlayManager.setLegalMoveDots([], this.boardFlipped)
      }

      this.requestRender()
    }

    // Initial update
    updateFromStore(store)

    // Subscribe to store updates
    const unsubscribe = (store.setState as any).subscribe
      ? (store.setState as any).subscribe(updateFromStore)
      : () => {}

    return unsubscribe
  }

  requestRender(): void {
    this.dirty = true
    if (this.rafHandle === null) {
      this.rafHandle = requestAnimationFrame((t) => this.frame(t))
    }
  }

  private frame(_t: number): void {
    this.rafHandle = null
    const isAnimating = this.animEngine.update()

    if (this.dirty || isAnimating) {
      this.webglRenderer.render(this.scene, this.camera)
      this.dirty = false
    }

    if (isAnimating) {
      this.requestRender()
    }
  }

  private resize(): void {
    const width = this.canvas.parentElement?.clientWidth || window.innerWidth
    const height = this.canvas.parentElement?.clientHeight || window.innerHeight

    this.webglRenderer.setSize(width, height, false)

    const aspect = width / height
    const extent = 10.0
    const padding = 1.15

    const halfH = (extent * padding) / 2
    const halfW = halfH * aspect

    this.camera.left = -halfW
    this.camera.right = halfW
    this.camera.top = halfH
    this.camera.bottom = -halfH
    this.camera.updateProjectionMatrix()

    this.requestRender()
  }

  cancelAllAnimations(): void {
    this.animEngine.cancelAll()
    this.requestRender()
  }

  setTheme(theme: Theme): void {
    this.theme = theme
    this.scene.background = new THREE.Color(theme.background)
    this.requestRender()
  }

  async flip(_animated = true): Promise<void> {
    this.boardFlipped = !this.boardFlipped
    this.requestRender()
  }

  private handlePointerDown(e: PointerEvent): void {
    const sq = raycastToSquare(e, this.canvas, this.camera, this.raycaster, this.boardFlipped)
    if (sq !== null && this.onSquarePointerDown) {
      this.onSquarePointerDown(sq, e)
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    const sq = raycastToSquare(e, this.canvas, this.camera, this.raycaster, this.boardFlipped)
    if (sq !== null && this.onSquarePointerUp) {
      this.onSquarePointerUp(sq, e)
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (e.pointerType === 'touch') return
    const sq = raycastToSquare(e, this.canvas, this.camera, this.raycaster, this.boardFlipped)
    if (sq !== this.hoveredSquare) {
      this.hoveredSquare = sq
      if (this.onSquareHover) {
        this.onSquareHover(sq)
      }
    }
  }
}
