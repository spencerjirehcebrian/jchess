import { Move } from "./types";
import { Position, toSan, toUci } from "./rules";

export interface NotationState {
  buffer: string;
  candidates: Move[];
  /**
   * The candidates' SAN, parallel to `candidates` and rendered against the very
   * position they were matched on.
   *
   * Callers must display these rather than calling `toSan` again. `makeSan`
   * disambiguates by looking for rival pieces of `pos.turn`, so rendering a
   * candidate against a position with the other side to move silently drops the
   * disambiguating letter — two knights that both reach f3 both come back as
   * `Nf3`. That is exactly what happens in premove mode, where the candidates
   * are generated on a turn-swapped board. Handing back the strings computed
   * here makes the mismatch unrepresentable.
   */
  candidateSans: string[];
  ambiguous: boolean;
  exactMatch: Move | null;
}

function normalizeSanInput(raw: string): string[] {
  let s = raw.trim().replace(/[+#]/g, "");
  if (!s) return [];

  // Replace castle variants: 0-0 -> O-O, 0-0-0 -> O-O-O, oo -> O-O, ooo -> O-O-O
  if (s.toLowerCase() === "ooo" || s === "0-0-0") return ["O-O-O"];
  if (s.toLowerCase() === "oo" || s === "0-0") return ["O-O"];

  // If buffer starts with 'b', it could be bishop 'B' or file 'b'
  if (s[0] === "b") {
    const uppercaseVersion = "B" + s.slice(1);
    const lowercaseVersion = s;
    return Array.from(new Set([uppercaseVersion, lowercaseVersion]));
  }

  // Capitalize piece letter if first character is n, r, q, k
  if (["n", "r", "q", "k"].includes(s[0]!.toLowerCase())) {
    s = s[0]!.toUpperCase() + s.slice(1);
  }

  return [s];
}

export function matchPrefix(
  buffer: string,
  legals: Move[],
  pos: Position,
): NotationState {
  const cleanBuffer = buffer.trim().replace(/[+#]/g, "");
  if (!cleanBuffer) {
    return {
      buffer,
      candidates: legals,
      candidateSans: legals.map((m) => toSan(pos, m)),
      ambiguous: false,
      exactMatch: null,
    };
  }

  const variations = normalizeSanInput(cleanBuffer);
  const candidateMap = new Map<string, { move: Move; san: string }>();

  for (const m of legals) {
    const san = toSan(pos, m);
    const sanStr = san.replace(/[+#]/g, "");
    const uciStr = toUci(m);
    const moveKey = uciStr;

    for (const v of variations) {
      const vLower = v.toLowerCase();
      const sanLower = sanStr.toLowerCase();
      const uciLower = uciStr.toLowerCase();

      // Lenient matching: allow optional 'x'
      const sanNoX = sanLower.replace(/x/g, "");
      const vNoX = vLower.replace(/x/g, "");

      if (
        sanLower.startsWith(vLower) ||
        uciLower.startsWith(vLower) ||
        sanNoX.startsWith(vNoX)
      ) {
        candidateMap.set(moveKey, { move: m, san });
      }
    }
  }

  const matched = Array.from(candidateMap.values());
  const candidates = matched.map((c) => c.move);
  const candidateSans = matched.map((c) => c.san);

  // Check exact match
  let exactMatch: Move | null = null;
  if (matched.length === 1) {
    exactMatch = matched[0]!.move;
  } else {
    // Check if one candidate exactly matches the typed input
    for (const { move, san } of matched) {
      const sanStr = san.replace(/[+#]/g, "");
      const uciStr = toUci(move);
      for (const v of variations) {
        if (
          sanStr.toLowerCase() === v.toLowerCase() ||
          uciStr.toLowerCase() === v.toLowerCase()
        ) {
          exactMatch = move;
          break;
        }
      }
      if (exactMatch) break;
    }
  }

  // Handle 'b' ambiguity flag if both file b move and Bishop move match
  let ambiguous = false;
  if (cleanBuffer[0] === "b" && candidates.length > 1) {
    const bBishopMatches = candidates.filter((m) => {
      const p = pos.board.get(m.from);
      return p && p.role === "bishop";
    });
    const bPawnMatches = candidates.filter((m) => {
      const p = pos.board.get(m.from);
      return p && p.role === "pawn";
    });
    if (bBishopMatches.length > 0 && bPawnMatches.length > 0) {
      ambiguous = true;
    }
  }

  return {
    buffer,
    candidates,
    candidateSans,
    ambiguous,
    exactMatch,
  };
}
