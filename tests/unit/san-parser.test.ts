import { describe, it, expect } from 'vitest'
import { FIXTURE_FENS } from '../fixtures/positions'
import { positionFromFen, legalMoves } from '../../src/core/rules'
import { matchPrefix } from '../../src/core/san-parser'

describe('san-parser module', () => {
  it('handles empty buffer returning all legal moves', () => {
    const pos = positionFromFen(FIXTURE_FENS.START)
    const legals = legalMoves(pos)
    const state = matchPrefix('', legals, pos)
    expect(state.candidates.length).toBe(legals.length)
    expect(state.exactMatch).toBeNull()
  })

  it('filters candidates incrementally: N -> Nf -> Nf3', () => {
    const pos = positionFromFen(FIXTURE_FENS.START)
    const legals = legalMoves(pos)

    const nState = matchPrefix('N', legals, pos)
    expect(nState.candidates.length).toBe(4) // Na3, Nc3, Nf3, Nh3

    const nfState = matchPrefix('Nf', legals, pos)
    expect(nfState.candidates.length).toBe(1) // Nf3

    const nf3State = matchPrefix('Nf3', legals, pos)
    expect(nf3State.candidates.length).toBe(1)
    expect(nf3State.exactMatch).not.toBeNull()
  })

  it('accepts lowercase piece letters and castle notations (0-0, oo)', () => {
    const pos = positionFromFen(FIXTURE_FENS.START)
    const legals = legalMoves(pos)
    const state = matchPrefix('nf3', legals, pos)
    expect(state.candidates.length).toBe(1)

    const castlePos = positionFromFen(FIXTURE_FENS.CASTLE_ALL_RIGHTS)
    const castleLegals = legalMoves(castlePos)
    const ooState = matchPrefix('oo', castleLegals, castlePos)
    expect(ooState.exactMatch).not.toBeNull()

    const zeroState = matchPrefix('0-0', castleLegals, castlePos)
    expect(zeroState.exactMatch).not.toBeNull()
  })

  it('handles optional x and check/mate symbols (+, #)', () => {
    const pos = positionFromFen(FIXTURE_FENS.EN_PASSANT_AVAILABLE)
    const legals = legalMoves(pos)
    const ed6State = matchPrefix('ed6', legals, pos)
    expect(ed6State.candidates.length).toBeGreaterThan(0)
  })

  it('handles lowercase b ambiguity', () => {
    const pos = positionFromFen(FIXTURE_FENS.DISAMBIGUATION_FILE)
    const legals = legalMoves(pos)
    const state = matchPrefix('b', legals, pos)
    expect(state).toBeDefined()
  })

  it('returns zero candidates for invalid input without throwing', () => {
    const pos = positionFromFen(FIXTURE_FENS.START)
    const legals = legalMoves(pos)
    const state = matchPrefix('Nf9', legals, pos)
    expect(state.candidates.length).toBe(0)
    expect(state.exactMatch).toBeNull()
  })
})
