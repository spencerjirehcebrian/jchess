import { Move } from './types'
import { Position, toSan, toUci } from './rules'

export interface NotationState {
  buffer: string
  candidates: Move[]
  ambiguous: boolean
  exactMatch: Move | null
}

function normalizeSanInput(raw: string): string[] {
  let s = raw.trim().replace(/[+#]/g, '')
  if (!s) return []

  // Replace castle variants: 0-0 -> O-O, 0-0-0 -> O-O-O, oo -> O-O, ooo -> O-O-O
  if (s.toLowerCase() === 'ooo' || s === '0-0-0') return ['O-O-O']
  if (s.toLowerCase() === 'oo' || s === '0-0') return ['O-O']

  // If buffer starts with 'b', it could be bishop 'B' or file 'b'
  if (s[0] === 'b') {
    const uppercaseVersion = 'B' + s.slice(1)
    const lowercaseVersion = s
    return Array.from(new Set([uppercaseVersion, lowercaseVersion]))
  }

  // Capitalize piece letter if first character is n, r, q, k
  if (['n', 'r', 'q', 'k'].includes(s[0]!.toLowerCase())) {
    s = s[0]!.toUpperCase() + s.slice(1)
  }

  return [s]
}

export function matchPrefix(buffer: string, legals: Move[], pos: Position): NotationState {
  const cleanBuffer = buffer.trim().replace(/[+#]/g, '')
  if (!cleanBuffer) {
    return {
      buffer,
      candidates: legals,
      ambiguous: false,
      exactMatch: null
    }
  }

  const variations = normalizeSanInput(cleanBuffer)
  const candidateMap = new Map<string, Move>()

  for (const m of legals) {
    const sanStr = toSan(pos, m).replace(/[+#]/g, '')
    const uciStr = toUci(m)
    const moveKey = uciStr

    for (const v of variations) {
      const vLower = v.toLowerCase()
      const sanLower = sanStr.toLowerCase()
      const uciLower = uciStr.toLowerCase()

      // Lenient matching: allow optional 'x'
      const sanNoX = sanLower.replace(/x/g, '')
      const vNoX = vLower.replace(/x/g, '')

      if (
        sanLower.startsWith(vLower) ||
        uciLower.startsWith(vLower) ||
        sanNoX.startsWith(vNoX)
      ) {
        candidateMap.set(moveKey, m)
      }
    }
  }

  const candidates = Array.from(candidateMap.values())

  // Check exact match
  let exactMatch: Move | null = null;
  if (candidates.length === 1) {
    exactMatch = candidates[0]!
  } else {
    // Check if one candidate exactly matches the typed input
    for (const m of candidates) {
      const sanStr = toSan(pos, m).replace(/[+#]/g, '')
      const uciStr = toUci(m)
      for (const v of variations) {
        if (
          sanStr.toLowerCase() === v.toLowerCase() ||
          uciStr.toLowerCase() === v.toLowerCase()
        ) {
          exactMatch = m
          break
        }
      }
      if (exactMatch) break
    }
  }

  // Handle 'b' ambiguity flag if both file b move and Bishop move match
  let ambiguous = false
  if (cleanBuffer[0] === 'b' && candidates.length > 1) {
    const bBishopMatches = candidates.filter((m) => {
      const p = pos.board.get(m.from)
      return p && p.role === 'bishop'
    })
    const bPawnMatches = candidates.filter((m) => {
      const p = pos.board.get(m.from)
      return p && p.role === 'pawn'
    })
    if (bBishopMatches.length > 0 && bPawnMatches.length > 0) {
      ambiguous = true
    }
  }

  return {
    buffer,
    candidates,
    ambiguous,
    exactMatch
  }
}
