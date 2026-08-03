import { Square, Move } from "./types";
import { Position } from "./rules";
import { squareRank, squareFile } from "chessops";

export const PREMOVE_OWN_PIECES_BLOCK = true;

export function premoveDestinations(pos: Position, from: Square): Square[] {
  const piece = pos.board.get(from);
  if (!piece) return [];

  const ownColor = piece.color;
  const ownPieces = pos.board[ownColor];
  const isOwnPiece = (sq: Square) =>
    PREMOVE_OWN_PIECES_BLOCK && ownPieces.has(sq);

  const destinations: Square[] = [];
  const rank = squareRank(from);
  const file = squareFile(from);

  if (piece.role === "knight") {
    const deltas = [-17, -15, -10, -6, 6, 10, 15, 17];
    for (const d of deltas) {
      const target = from + d;
      if (target >= 0 && target < 64) {
        const targetFile = squareFile(target);
        if (Math.abs(file - targetFile) <= 2 && !isOwnPiece(target)) {
          destinations.push(target);
        }
      }
    }
  } else if (piece.role === "king") {
    const deltas = [-9, -8, -7, -1, 1, 7, 8, 9];
    for (const d of deltas) {
      const target = from + d;
      if (target >= 0 && target < 64) {
        const targetFile = squareFile(target);
        if (Math.abs(file - targetFile) <= 1 && !isOwnPiece(target)) {
          destinations.push(target);
        }
      }
    }
    // Castling rights check
    const castlingRights = pos.castles.castlingRights;
    if (ownColor === "white" && from === 4) {
      // Kingside castling right
      if (castlingRights.has(7) || castlingRights.has(6)) {
        if (!isOwnPiece(6)) destinations.push(6);
      }
      // Queenside castling right
      if (castlingRights.has(0) || castlingRights.has(2)) {
        if (!isOwnPiece(2)) destinations.push(2);
      }
    } else if (ownColor === "black" && from === 60) {
      if (castlingRights.has(63) || castlingRights.has(62)) {
        if (!isOwnPiece(62)) destinations.push(62);
      }
      if (castlingRights.has(56) || castlingRights.has(58)) {
        if (!isOwnPiece(58)) destinations.push(58);
      }
    }
  } else if (piece.role === "pawn") {
    const dir = ownColor === "white" ? 1 : -1;
    const startRank = ownColor === "white" ? 1 : 6;

    // 1-step forward push
    const step1 = from + dir * 8;
    if (step1 >= 0 && step1 < 64 && !isOwnPiece(step1)) {
      destinations.push(step1);
      // 2-step forward push from start rank
      if (rank === startRank) {
        const step2 = from + dir * 16;
        if (step2 >= 0 && step2 < 64 && !isOwnPiece(step2)) {
          destinations.push(step2);
        }
      }
    }

    // Pawn captures (diagonals)
    const capFiles = [file - 1, file + 1];
    const capRank = rank + dir;
    if (capRank >= 0 && capRank <= 7) {
      for (const f of capFiles) {
        if (f >= 0 && f <= 7) {
          const capSquare = capRank * 8 + f;
          if (!isOwnPiece(capSquare)) {
            destinations.push(capSquare);
          }
        }
      }
    }
  } else {
    // Sliding pieces: Bishop, Rook, Queen
    const directions: [number, number][] = [];
    if (piece.role === "rook" || piece.role === "queen") {
      directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    }
    if (piece.role === "bishop" || piece.role === "queen") {
      directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    }

    for (const [df, dr] of directions) {
      let curF = file + df;
      let curR = rank + dr;
      while (curF >= 0 && curF <= 7 && curR >= 0 && curR <= 7) {
        const target = curR * 8 + curF;
        if (isOwnPiece(target)) {
          break; // Ray stops at own piece
        }
        destinations.push(target);
        // Ray DOES NOT stop at enemy piece in premove relaxed generation!
        curF += df;
        curR += dr;
      }
    }
  }

  return destinations;
}

/**
 * The board a queued premove should be validated against: your own premoves
 * applied, opponent pieces left where they are. This is deliberately not
 * `pos.play()` — the intermediate boards are not legal chess positions (the
 * turn never passes to the opponent), so each premove is applied as a raw
 * board mutation instead.
 */
export function hypotheticalPosition(
  pos: Position,
  premoves: Move[],
): Position {
  if (premoves.length === 0) return pos;

  const next = pos.clone();
  for (const move of premoves) {
    const piece = next.board.take(move.from);
    if (!piece) continue;

    next.board.take(move.to);
    next.board.set(
      move.to,
      move.promotion ? { ...piece, role: move.promotion } : piece,
    );

    // Castling is encoded as the king's destination square; move the rook too.
    if (piece.role === "king" && Math.abs(squareFile(move.to) - squareFile(move.from)) > 1) {
      const rank = squareRank(move.from);
      const isKingside = squareFile(move.to) > squareFile(move.from);
      const rookFrom = rank * 8 + (isKingside ? 7 : 0);
      const rookTo = rank * 8 + (isKingside ? 5 : 3);
      const rook = next.board.take(rookFrom);
      if (rook) {
        next.board.take(rookTo);
        next.board.set(rookTo, rook);
      }
    }
  }

  return next;
}

export function generatePremoves(pos: Position, from: Square): Move[] {
  const piece = pos.board.get(from);
  if (!piece) return [];

  const dests = premoveDestinations(pos, from);
  const result: Move[] = [];
  const lastRank = piece.color === "white" ? 7 : 0;

  for (const to of dests) {
    if (piece.role === "pawn" && squareRank(to) === lastRank) {
      result.push({ from, to, promotion: "queen" });
      result.push({ from, to, promotion: "rook" });
      result.push({ from, to, promotion: "bishop" });
      result.push({ from, to, promotion: "knight" });
    } else {
      result.push({ from, to });
    }
  }

  return result;
}
