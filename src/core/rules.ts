import "chessops/squareSet";
import "chessops/attacks";
import { Chess, fen, san } from "chessops";
import {
  Square,
  Move,
  Color,
  Role,
  HistoryEntry,
  Result,
  squareToName,
  nameToSquare,
} from "./types";

export type Position = Chess;

export function positionFromFen(fenStr: string): Position {
  const setup = fen.parseFen(fenStr).unwrap();
  return Chess.fromSetup(setup).unwrap();
}

export function positionAfter(initialFen: string, moves: Move[]): Position {
  const pos = positionFromFen(initialFen);
  for (const m of moves) {
    const chessopsMove = toChessopsMove(m);
    pos.play(chessopsMove);
  }
  return pos;
}

function toChessopsMove(move: Move) {
  return move.promotion
    ? { from: move.from, to: move.to, promotion: move.promotion }
    : { from: move.from, to: move.to };
}

export function legalMovesFrom(pos: Position, from: Square): Move[] {
  const piece = pos.board.get(from);
  if (!piece || piece.color !== pos.turn) return [];

  const dests = pos.dests(from);
  const result: Move[] = [];

  const isPawn = piece.role === "pawn";
  const lastRank = pos.turn === "white" ? 7 : 0;

  for (const to of dests) {
    let targetSquare = to;
    if (piece.role === "king") {
      if (from === 4 && to === 7) targetSquare = 6;
      if (from === 4 && to === 0) targetSquare = 2;
      if (from === 60 && to === 63) targetSquare = 62;
      if (from === 60 && to === 56) targetSquare = 58;
    }

    const toRank = Math.floor(targetSquare / 8);
    if (isPawn && toRank === lastRank) {
      const promotions: Exclude<Role, "pawn" | "king">[] = [
        "queen",
        "rook",
        "bishop",
        "knight",
      ];
      for (const p of promotions) {
        result.push({ from, to: targetSquare, promotion: p });
      }
    } else {
      result.push({ from, to: targetSquare });
    }
  }

  return result;
}

export function legalMoves(pos: Position): Move[] {
  const moves: Move[] = [];
  for (const sq of pos.board[pos.turn]) {
    moves.push(...legalMovesFrom(pos, sq));
  }
  return moves;
}

export function isLegal(pos: Position, move: Move): boolean {
  const legals = legalMovesFrom(pos, move.from);
  return legals.some(
    (m) =>
      m.from === move.from &&
      m.to === move.to &&
      m.promotion === move.promotion,
  );
}

export function toSan(pos: Position, move: Move): string {
  const chessopsMove = toChessopsMove(move);
  return san.makeSan(pos, chessopsMove);
}

export function fromSan(pos: Position, sanStr: string): Move | null {
  const parsed = san.parseSan(pos, sanStr);
  if (!parsed || !("from" in parsed)) return null;
  let to = parsed.to;
  const piece = pos.board.get(parsed.from);
  if (piece && piece.role === "king") {
    if (parsed.from === 4 && parsed.to === 7) to = 6;
    if (parsed.from === 4 && parsed.to === 0) to = 2;
    if (parsed.from === 60 && parsed.to === 63) to = 62;
    if (parsed.from === 60 && parsed.to === 56) to = 58;
  }
  return {
    from: parsed.from,
    to,
    promotion: parsed.promotion as Exclude<Role, "pawn" | "king"> | undefined,
  };
}

export function toUci(move: Move): string {
  const fromName = squareToName(move.from);
  const toName = squareToName(move.to);
  const promo = move.promotion
    ? move.promotion === "knight"
      ? "n"
      : move.promotion[0]!
    : "";
  return `${fromName}${toName}${promo}`;
}

/**
 * Parses a UCI move. Pass `pos` whenever one is available: the king-takes-rook
 * castling encoding is remapped to this codebase's king-destination convention
 * only when the piece on `from` is actually a king, so an ordinary back-rank
 * rook move like `e1h1` is not silently rewritten to `e1g1`. With `pos`
 * omitted the remap is unconditional, preserving the pure toUci/fromUci
 * string round-trip.
 */
export function fromUci(uciStr: string, pos?: Position): Move | null {
  if (uciStr.length < 4 || uciStr.length > 5) return null;
  const from = nameToSquare(uciStr.slice(0, 2));
  let to = nameToSquare(uciStr.slice(2, 4));
  if (from === null || to === null) return null;

  const movingPiece = pos?.board.get(from);
  if (!pos || movingPiece?.role === "king") {
    if (from === 4 && to === 7) to = 6;
    if (from === 4 && to === 0) to = 2;
    if (from === 60 && to === 63) to = 62;
    if (from === 60 && to === 56) to = 58;
  }

  let promotion: Exclude<Role, "pawn" | "king"> | undefined = undefined;
  if (uciStr.length === 5) {
    const promoChar = uciStr[4]!.toLowerCase();
    switch (promoChar) {
      case "q":
        promotion = "queen";
        break;
      case "r":
        promotion = "rook";
        break;
      case "b":
        promotion = "bishop";
        break;
      case "n":
        promotion = "knight";
        break;
      default:
        return null;
    }
  }

  return { from, to, promotion };
}

export function toFen(pos: Position): string {
  return fen.makeFen(pos.toSetup());
}

/**
 * Everything the history records about a move, and the position it produced.
 *
 * The SAN has to be taken before the move is played and the check flags after,
 * so this is the one order that is correct. Three callers used to write it out
 * by hand — the human move, the engine's reply, and the premove drain — each
 * replaying the whole game from the initial FEN to get the position after.
 */
export function buildHistoryEntry(
  pos: Position,
  move: Move,
): { entry: HistoryEntry; posAfter: Position } {
  const sanStr = toSan(pos, move);
  const captured = pos.board.get(move.to)?.role;

  const posAfter = pos.clone();
  posAfter.play(toChessopsMove(move));

  const check = posAfter.isCheck();

  return {
    entry: {
      move,
      san: sanStr,
      fenAfter: toFen(posAfter),
      captured,
      isCheck: check,
      isMate: posAfter.isEnd() && check,
    },
    posAfter,
  };
}

export function isCheck(pos: Position): boolean {
  return pos.isCheck();
}

export function kingSquare(pos: Position, color: Color): Square {
  const sq = pos.board.kingOf(color);
  return sq !== undefined ? sq : color === "white" ? 4 : 60;
}

export function isInsufficientMaterial(pos: Position): boolean {
  const wPieces = Array.from(pos.board.white);
  const bPieces = Array.from(pos.board.black);

  if (wPieces.length === 1 && bPieces.length === 1) return true;

  if (wPieces.length === 2 && bPieces.length === 1) {
    const minor = wPieces.find((sq) => sq !== pos.board.kingOf("white"));
    if (minor !== undefined) {
      const role = pos.board.get(minor)?.role;
      if (role === "knight" || role === "bishop") return true;
    }
  }
  if (bPieces.length === 2 && wPieces.length === 1) {
    const minor = bPieces.find((sq) => sq !== pos.board.kingOf("black"));
    if (minor !== undefined) {
      const role = pos.board.get(minor)?.role;
      if (role === "knight" || role === "bishop") return true;
    }
  }

  if (wPieces.length === 2 && bPieces.length === 2) {
    const wMinor = wPieces.find((sq) => sq !== pos.board.kingOf("white"));
    const bMinor = bPieces.find((sq) => sq !== pos.board.kingOf("black"));
    if (wMinor !== undefined && bMinor !== undefined) {
      const wRole = pos.board.get(wMinor)?.role;
      const bRole = pos.board.get(bMinor)?.role;
      if (wRole === "bishop" && bRole === "bishop") {
        const wColorSquare = (Math.floor(wMinor / 8) + (wMinor % 8)) % 2;
        const bColorSquare = (Math.floor(bMinor / 8) + (bMinor % 8)) % 2;
        if (wColorSquare === bColorSquare) return true;
      }
    }
  }

  return false;
}

export function outcome(
  pos: Position,
  history: HistoryEntry[],
  initialFen?: string,
): Result | null {
  if (isInsufficientMaterial(pos)) {
    return { winner: null, reason: "insufficient-material" };
  }

  if (pos.isEnd()) {
    if (pos.isCheck()) {
      const winner: Color = pos.turn === "white" ? "black" : "white";
      return { winner, reason: "checkmate" };
    } else {
      return { winner: null, reason: "stalemate" };
    }
  }

  if (pos.halfmoves >= 100) {
    return { winner: null, reason: "fifty-move" };
  }

  const extractKey = (fenString: string) =>
    fenString.split(" ").slice(0, 4).join(" ");
  const currentKey = extractKey(toFen(pos));
  let count = 0;
  if (initialFen && extractKey(initialFen) === currentKey) {
    count++;
  }
  for (const h of history) {
    if (extractKey(h.fenAfter) === currentKey) {
      count++;
    }
  }
  if (count >= 3) {
    return { winner: null, reason: "threefold" };
  }

  return null;
}
