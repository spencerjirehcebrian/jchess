import { describe, it, expect } from 'vitest'
import { FIXTURE_FENS } from '../fixtures/positions'
import {
  positionFromFen,
  legalMoves,
  legalMovesFrom,
  toSan,
  fromSan,
  toUci,
  fromUci,
  toFen,
  outcome,
  isCheck,
  kingSquare
} from '../../src/core/rules'
import { nameToSquare } from '../../src/core/types'

describe('rules module', () => {
  it('parses START position and generates legal moves', () => {
    const pos = positionFromFen(FIXTURE_FENS.START)
    const moves = legalMoves(pos)
    expect(moves.length).toBe(20)
  })

  it('SAN round-trip for START position moves', () => {
    const pos = positionFromFen(FIXTURE_FENS.START)
    const moves = legalMoves(pos)
    for (const m of moves) {
      const sanStr = toSan(pos, m)
      const parsed = fromSan(pos, sanStr)
      expect(parsed).not.toBeNull()
      expect(parsed?.from).toBe(m.from)
      expect(parsed?.to).toBe(m.to)
    }
  })

  it('UCI round-trip for moves including promotions', () => {
    const pos = positionFromFen(FIXTURE_FENS.PROMOTION_PUSH)
    const e7 = nameToSquare('e7')!
    const e7Moves = legalMovesFrom(pos, e7)
    expect(e7Moves.length).toBe(4) // 4 promotions
    for (const m of e7Moves) {
      const uciStr = toUci(m)
      const parsed = fromUci(uciStr)
      expect(parsed).toEqual(m)
    }
  })

  it('FEN round-trip for all 22 fixtures', () => {
    for (const [_, fenStr] of Object.entries(FIXTURE_FENS)) {
      const pos = positionFromFen(fenStr)
      const roundTripFen = toFen(pos)
      expect(roundTripFen).toBeTruthy()
    }
  })

  it('handles en passant capture availability and pin', () => {
    const epAvailable = positionFromFen(FIXTURE_FENS.EN_PASSANT_AVAILABLE)
    const epMoves = legalMoves(epAvailable)
    expect(epMoves.some((m) => m.from === 36 && m.to === 43)).toBe(true)

    const epPinned = positionFromFen(FIXTURE_FENS.EN_PASSANT_PINNED)
    const epPinnedMoves = legalMoves(epPinned)
    expect(epPinnedMoves.some((m) => m.from === 28 && m.to === 43)).toBe(false)
  })

  it('handles castling rights and through-check restriction', () => {
    const allRights = positionFromFen(FIXTURE_FENS.CASTLE_ALL_RIGHTS)
    const allRightsMoves = legalMoves(allRights)
    expect(allRightsMoves.some((m) => m.from === 4 && m.to === 6)).toBe(true)
    expect(allRightsMoves.some((m) => m.from === 4 && m.to === 2)).toBe(true)

    const throughCheck = positionFromFen(FIXTURE_FENS.CASTLE_THROUGH_CHECK)
    const throughCheckMoves = legalMoves(throughCheck)
    expect(throughCheckMoves.some((m) => m.from === 4 && m.to === 6)).toBe(false)
  })

  it('detects terminal position outcomes (checkmate, stalemate, insufficient material)', () => {
    const matePosAfter = positionFromFen('3R2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1')
    const res = outcome(matePosAfter, [])
    expect(res).toEqual({ winner: 'white', reason: 'checkmate' })

    const stalePos = positionFromFen(FIXTURE_FENS.STALEMATE)
    const staleRes = outcome(stalePos, [])
    expect(staleRes).toEqual({ winner: null, reason: 'stalemate' })

    const insuffPos = positionFromFen(FIXTURE_FENS.INSUFFICIENT_KN_K)
    const insuffRes = outcome(insuffPos, [])
    expect(insuffRes).toEqual({ winner: null, reason: 'insufficient-material' })
  })

  it('identifies king square and check state', () => {
    const pos = positionFromFen(FIXTURE_FENS.DOUBLE_CHECK)
    expect(isCheck(pos)).toBe(true)
    expect(kingSquare(pos, 'white')).toBe(4) // e1
  })
})
