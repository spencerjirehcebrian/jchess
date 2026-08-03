import * as THREE from 'three'
import { Square } from '../core/types'
import { squareToWorld } from './picking'
import { Theme } from './voxel/palette'

export class OverlayManager {
  readonly group = new THREE.Group()

  private lastMoveFromQuad: THREE.Mesh
  private lastMoveToQuad: THREE.Mesh
  private selectedSquareQuad: THREE.Mesh
  private legalDotsGroup = new THREE.Group()
  private legalDotsPool: THREE.Mesh[] = []

  constructor(theme: Theme) {
    this.group.name = 'overlayGroup'
    this.group.position.y = 0.02

    const squareGeo = new THREE.PlaneGeometry(0.96, 0.96)
    squareGeo.rotateX(-Math.PI / 2)

    // Last move from
    const fromMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.white.detail),
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    })
    this.lastMoveFromQuad = new THREE.Mesh(squareGeo, fromMat)
    this.lastMoveFromQuad.visible = false
    this.group.add(this.lastMoveFromQuad)

    // Last move to
    const toMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.white.detail),
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    })
    this.lastMoveToQuad = new THREE.Mesh(squareGeo, toMat)
    this.lastMoveToQuad.visible = false
    this.group.add(this.lastMoveToQuad)

    // Selected square
    const selMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.white.detail),
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    })
    this.selectedSquareQuad = new THREE.Mesh(squareGeo, selMat)
    this.selectedSquareQuad.visible = false
    this.group.add(this.selectedSquareQuad)

    // Legal move dots pool (up to 28)
    const dotGeo = new THREE.CircleGeometry(0.12, 16)
    dotGeo.rotateX(-Math.PI / 2)
    const dotMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.white.detail),
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    })

    for (let i = 0; i < 28; i++) {
      const dot = new THREE.Mesh(dotGeo, dotMat)
      dot.visible = false
      this.legalDotsPool.push(dot)
      this.legalDotsGroup.add(dot)
    }
    this.group.add(this.legalDotsGroup)
  }

  setLastMove(from: Square | null, to: Square | null, boardFlipped: boolean) {
    if (from !== null) {
      const pos = squareToWorld(from, boardFlipped)
      this.lastMoveFromQuad.position.set(pos.x, 0, pos.z)
      this.lastMoveFromQuad.visible = true
    } else {
      this.lastMoveFromQuad.visible = false
    }

    if (to !== null) {
      const pos = squareToWorld(to, boardFlipped)
      this.lastMoveToQuad.position.set(pos.x, 0, pos.z)
      this.lastMoveToQuad.visible = true
    } else {
      this.lastMoveToQuad.visible = false
    }
  }

  setSelectedSquare(square: Square | null, boardFlipped: boolean) {
    if (square !== null) {
      const pos = squareToWorld(square, boardFlipped)
      this.selectedSquareQuad.position.set(pos.x, 0, pos.z)
      this.selectedSquareQuad.visible = true
    } else {
      this.selectedSquareQuad.visible = false
    }
  }

  setLegalMoveDots(squares: Square[], boardFlipped: boolean) {
    for (let i = 0; i < this.legalDotsPool.length; i++) {
      const dot = this.legalDotsPool[i]!
      if (i < squares.length) {
        const sq = squares[i]!
        const pos = squareToWorld(sq, boardFlipped)
        dot.position.set(pos.x, 0, pos.z)
        dot.visible = true
      } else {
        dot.visible = false
      }
    }
  }

  clearAll() {
    this.lastMoveFromQuad.visible = false
    this.lastMoveToQuad.visible = false
    this.selectedSquareQuad.visible = false
    for (const dot of this.legalDotsPool) {
      dot.visible = false
    }
  }
}
