import { Store } from "./index";
import { Move, Color, AppError, GameState } from "../core/types";
import { Engine, isSearchCancelled } from "../engine/types";
import {
  positionAfter,
  positionFromFen,
  isLegal,
  outcome,
  toUci,
  fromUci,
  buildHistoryEntry,
} from "../core/rules";
import { RestoredGame } from "../core/pgn";
import { generatePremoves, hypotheticalPosition } from "../core/premove";
import { getDifficulty } from "../core/difficulty";
import { audioEngine } from "../audio";
import { getConfig } from "../config";
import { THEMES, applyThemeToCss } from "../render/voxel/palette";

function newGameId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `game-${crypto.randomUUID()}`;
  }
  return `game-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export class GameController {
  private store: Store;

  private get state(): GameState {
    if (
      "getState" in (this.store as any) &&
      typeof (this.store as any).getState === "function"
    ) {
      return (this.store as any).getState();
    }
    return this.store as unknown as GameState;
  }
  private engine: Engine | null = null;

  /**
   * Bumped whenever the game changes underneath an in-flight search (new game,
   * takeback, history browsing, or a newer search starting). A search whose
   * epoch is stale discards its result instead of applying it to a position it
   * was never computed for.
   */
  private searchEpoch = 0;

  /** Notified with the squares of a premove queue that failed to drain. */
  onPremoveFailed: ((squares: number[]) => void) | null = null;

  constructor(store: Store, engine?: Engine) {
    this.store = store;
    if (engine) {
      this.engine = engine;
    }
  }

  setEngine(engine: Engine) {
    this.engine = engine;
  }

  /** Invalidates any in-flight search and cancels the engine's current one. */
  private cancelEngineSearch() {
    this.searchEpoch++;
    this.engine?.stop();
  }

  /** Fire-and-forget entry point; triggerEngineSearch never rejects. */
  private startEngineSearch(): void {
    void this.triggerEngineSearch().catch((err) => {
      console.error("Engine search pipeline error:", err);
    });
  }

  startNewGame(options?: {
    humanColor?: Color;
    difficulty?: number;
    initialFen?: string;
  }) {
    // Before any setState, so a reply already in flight is discarded rather
    // than appended to the freshly reset board.
    this.cancelEngineSearch();

    const config = getConfig();
    const humanColor = options?.humanColor ?? "white";
    const difficulty = options?.difficulty ?? this.state.difficulty ?? config.defaultDifficulty;
    const initialFen = options?.initialFen ?? this.state.initialFen;

    const newStatus =
      humanColor === "white"
        ? ({ kind: "human-turn" } as const)
        : ({ kind: "engine-thinking", startedAt: Date.now() } as const);

    this.store.setState(() => ({
      // A new id, so this game is a new record rather than an overwrite of the
      // one the player may still want to come back to.
      id: newGameId(),
      initialFen,
      humanColor,
      difficulty,
      history: [],
      cursor: 0,
      status: newStatus,
      premoves: [],
      selectedSquare: null,
      startedAt: Date.now(),
    }));

    if (humanColor === "black") {
      this.startEngineSearch();
    }
  }

  /**
   * Puts a stored game back on the board. The caller has already turned the
   * PGN into history — this decides whose move it is and restarts the engine if
   * the answer is the engine's.
   *
   * A resumed game comes back without a clock. PGN carries no time, and
   * handing back a full initial allowance would be a cheat.
   */
  resumeGame(
    restored: RestoredGame,
    meta: { id: string; humanColor: Color; difficulty: number },
  ): void {
    this.cancelEngineSearch();

    const posNow = positionAfter(
      restored.initialFen,
      restored.history.map((h) => h.move),
    );
    const finished = outcome(posNow, restored.history, restored.initialFen);
    const engineToMove = !finished && posNow.turn !== meta.humanColor;

    this.store.setState(() => ({
      id: meta.id,
      initialFen: restored.initialFen,
      humanColor: meta.humanColor,
      difficulty: meta.difficulty,
      history: restored.history,
      cursor: restored.history.length,
      status: finished
        ? { kind: "over", result: finished }
        : engineToMove
          ? { kind: "engine-thinking", startedAt: Date.now() }
          : { kind: "human-turn" },
      premoves: [],
      selectedSquare: null,
      clock: undefined,
      startedAt: restored.startedAt,
    }));

    if (engineToMove) this.startEngineSearch();
  }

  makeMove(move: Move): boolean {
    const state = this.state;
    if (state.cursor < state.history.length) {
      // Browsing history: reject move
      return false;
    }

    if (
      state.status.kind === "engine-thinking" ||
      state.status.kind === "engine-delaying"
    ) {
      // A full queue replaces the tail rather than rejecting: users correcting
      // the end of a chain expect replacement (docs/08-input.md).
      const config = getConfig();
      const maxPremoves = state.maxPremoves ?? config.maxPremoves;
      if (maxPremoves < 1) return false;
      const basePremoves = state.premoves.slice(0, maxPremoves - 1);

      // Each premove is validated against the hypothetical board produced by
      // applying the ones ahead of it, with opponent pieces left in place.
      const livePos = positionAfter(
        state.initialFen,
        state.history.map((h) => h.move),
      );
      const hypothetical = hypotheticalPosition(livePos, basePremoves);
      const piece = hypothetical.board.get(move.from);
      if (!piece || piece.color !== state.humanColor) return false;

      const candidates = generatePremoves(hypothetical, move.from);
      const matches = candidates.some(
        (m) => m.to === move.to && m.promotion === move.promotion,
      );
      if (!matches) return false;

      audioEngine.playSound("premove");
      this.store.setState(() => ({
        premoves: [...basePremoves, move],
        selectedSquare: null,
      }));
      return true;
    }

    if (state.status.kind !== "human-turn") {
      return false;
    }

    const currentPos = positionAfter(
      state.initialFen,
      state.history.map((h) => h.move),
    );

    if (!isLegal(currentPos, move)) {
      return false;
    }

    const { entry, posAfter } = buildHistoryEntry(currentPos, move);
    const newHistory = [...state.history, entry];

    const gameOutcome = outcome(posAfter, newHistory, state.initialFen);

    if (gameOutcome) {
      if (gameOutcome.winner === state.humanColor)
        audioEngine.playSound("victory");
      else if (gameOutcome.winner && gameOutcome.winner !== state.humanColor)
        audioEngine.playSound("defeat");
      else audioEngine.playSound("draw");

      this.store.setState(() => ({
        history: newHistory,
        cursor: newHistory.length,
        status: { kind: "over", result: gameOutcome },
        selectedSquare: null,
      }));
      return true;
    }

    if (entry.isCheck) audioEngine.playSound("check");
    else if (entry.captured) audioEngine.playSound("capture");
    else audioEngine.playSound("move");

    this.store.setState(() => ({
      history: newHistory,
      cursor: newHistory.length,
      status: { kind: "engine-thinking", startedAt: Date.now() },
      selectedSquare: null,
    }));

    this.startEngineSearch();
    return true;
  }

  private async triggerEngineSearch() {
    const engine = this.engine;
    if (!engine) return;

    // Starting a search supersedes any earlier one still awaiting a reply.
    const epoch = ++this.searchEpoch;
    const isCurrent = () => this.searchEpoch === epoch;

    try {
      const level = getDifficulty(this.state.difficulty);

      if (level.uciOptions) {
        // Inside the try: a setOptions rejection must surface as an error
        // status, not an unhandled rejection that strands the UI on "Thinking".
        await engine.setOptions(level.uciOptions);
        if (!isCurrent()) return;
      }

      // Re-read after every await; the pre-await snapshot may describe a game
      // that no longer exists.
      let state = this.state;
      if (state.status.kind !== "engine-thinking") return;

      const startTime = performance.now();
      const searchResult = await engine.search(
        state.initialFen,
        state.history.map((h) => toUci(h.move)),
        level.budget,
      );
      if (!isCurrent()) return;

      state = this.state;
      if (state.status.kind !== "engine-thinking") return;

      const currentPos = positionAfter(
        state.initialFen,
        state.history.map((h) => h.move),
      );
      const parsedMove = fromUci(searchResult.move, currentPos);

      if (!parsedMove || !isLegal(currentPos, parsedMove)) {
        this.store.setState(() => ({
          status: {
            kind: "error",
            error: {
              code: "ILLEGAL_ENGINE_MOVE",
              message: `Engine returned an illegal move: ${searchResult.move}`,
            },
          },
        }));
        return;
      }

      const elapsed = performance.now() - startTime;
      const [minThink, maxThink] = level.thinkTimeFloorMs;
      const targetThink =
        minThink + Math.floor(Math.random() * (maxThink - minThink + 1));
      const delayMs = level.id === 8 ? 0 : Math.max(0, targetThink - elapsed);

      if (delayMs > 0) {
        this.store.setState(() => ({
          status: {
            kind: "engine-delaying",
            move: parsedMove,
            until: Date.now() + delayMs,
          },
        }));
        await new Promise((r) => setTimeout(r, delayMs));
        if (!isCurrent()) return;
        if (this.state.status.kind !== "engine-delaying") return;
      }

      this.applyEngineMove(parsedMove);
    } catch (err: unknown) {
      // A cancelled search is not a failure — the caller asked for it.
      if (isSearchCancelled(err)) return;
      if (!isCurrent()) return;
      if (
        this.state.status.kind !== "engine-thinking" &&
        this.state.status.kind !== "engine-delaying"
      ) {
        return;
      }
      const appErr: AppError = {
        code: "ENGINE_SEARCH_FAILED",
        message: err instanceof Error ? err.message : "Engine search failed",
      };
      this.store.setState(() => ({
        status: { kind: "error", error: appErr },
      }));
    }
  }

  private applyEngineMove(move: Move) {
    const state = this.state;
    if (
      state.status.kind !== "engine-thinking" &&
      state.status.kind !== "engine-delaying"
    ) {
      return;
    }

    const currentPos = positionAfter(
      state.initialFen,
      state.history.map((h) => h.move),
    );

    // Last-line guard: this runs after an await, so re-validate against the
    // position the move is actually about to be applied to. Without it,
    // chessops silently no-ops on an empty `from` square while still flipping
    // the turn, desynchronising the board from the move list.
    if (!isLegal(currentPos, move)) {
      this.store.setState(() => ({
        status: {
          kind: "error",
          error: {
            code: "ILLEGAL_ENGINE_MOVE",
            message: `Engine move is no longer legal: ${toUci(move)}`,
          },
        },
      }));
      return;
    }

    const { entry, posAfter } = buildHistoryEntry(currentPos, move);
    const newHistory = [...state.history, entry];

    const gameOutcome = outcome(posAfter, newHistory, state.initialFen);

    if (gameOutcome) {
      if (gameOutcome.winner === state.humanColor)
        audioEngine.playSound("victory");
      else if (gameOutcome.winner && gameOutcome.winner !== state.humanColor)
        audioEngine.playSound("defeat");
      else audioEngine.playSound("draw");

      this.store.setState(() => ({
        history: newHistory,
        cursor: newHistory.length,
        status: { kind: "over", result: gameOutcome },
        premoves: [],
      }));
      return;
    }

    if (entry.isCheck) audioEngine.playSound("check");
    else if (entry.captured) audioEngine.playSound("capture");
    else audioEngine.playSound("move");

    // Drain premove queue
    if (state.premoves.length > 0) {
      const [headPremove, ...tailPremoves] = state.premoves;
      if (headPremove && isLegal(posAfter, headPremove)) {
        // Head premove is legal: apply it
        const { entry: premoveEntry, posAfter: posAfterPremove } =
          buildHistoryEntry(posAfter, headPremove);
        const historyWithPremove = [...newHistory, premoveEntry];

        const premoveOutcome = outcome(
          posAfterPremove,
          historyWithPremove,
          state.initialFen,
        );

        if (premoveOutcome) {
          if (premoveOutcome.winner === state.humanColor)
            audioEngine.playSound("victory");
          else if (
            premoveOutcome.winner &&
            premoveOutcome.winner !== state.humanColor
          )
            audioEngine.playSound("defeat");
          else audioEngine.playSound("draw");

          this.store.setState(() => ({
            history: historyWithPremove,
            cursor: historyWithPremove.length,
            status: { kind: "over", result: premoveOutcome },
            premoves: [],
          }));
          return;
        }

        if (premoveEntry.isCheck) audioEngine.playSound("check");
        else if (premoveEntry.captured) audioEngine.playSound("capture");
        else audioEngine.playSound("move");

        this.store.setState(() => ({
          history: historyWithPremove,
          cursor: historyWithPremove.length,
          status: { kind: "engine-thinking", startedAt: Date.now() },
          premoves: tailPremoves,
        }));

        this.startEngineSearch();
        return;
      } else {
        // Head premove illegal: clear entire queue
        this.store.setState(() => ({
          history: newHistory,
          cursor: newHistory.length,
          status: { kind: "human-turn" },
          premoves: [],
        }));
        if (headPremove) {
          this.onPremoveFailed?.([headPremove.from, headPremove.to]);
        }
        return;
      }
    }

    this.store.setState(() => ({
      history: newHistory,
      cursor: newHistory.length,
      status: { kind: "human-turn" },
    }));
  }

  /**
   * The history length to truncate to, or null when nothing can be taken back.
   *
   * The result must have the parity that puts the *human* on move. Removing a
   * fixed two plies is wrong whenever the last ply is the human's unanswered
   * move (the engine-thinking case), which leaves the engine to move while the
   * status claims otherwise and freezes the board.
   */
  private takebackTarget(): number | null {
    const state = this.state;
    const plies = state.history.length;
    if (plies === 0) return null;
    if (state.status.kind === "setup") return null;

    const startTurn = positionFromFen(state.initialFen).turn;
    const humanParity = startTurn === state.humanColor ? 0 : 1;

    let target = plies - 1;
    if (target % 2 !== humanParity) target -= 1;
    return target < 0 ? null : target;
  }

  canTakeback(): boolean {
    return this.takebackTarget() !== null;
  }

  takeback() {
    // Compute the target before cancelling: a no-op takeback must not kill a
    // legitimate in-flight search and strand the game in engine-thinking.
    const target = this.takebackTarget();
    if (target === null) return;

    this.cancelEngineSearch();

    const newHistory = this.state.history.slice(0, target);
    this.store.setState(() => ({
      history: newHistory,
      cursor: newHistory.length,
      status: { kind: "human-turn" },
      premoves: [],
      selectedSquare: null,
    }));
  }

  setCursor(index: number) {
    const state = this.state;
    const clampedIndex = Math.max(0, Math.min(state.history.length, index));
    if (clampedIndex === state.cursor) return;

    const wasLive = state.cursor === state.history.length;
    const nowLive = clampedIndex === state.history.length;
    const engineBusy =
      state.status.kind === "engine-thinking" ||
      state.status.kind === "engine-delaying";

    this.store.setState(() => ({
      cursor: clampedIndex,
      premoves: [],
    }));

    if (!engineBusy) return;

    if (wasLive && !nowLive) {
      // Browsing away from the live position: discard the in-flight reply.
      this.cancelEngineSearch();
    } else if (!wasLive && nowLive) {
      // Back to live with a search owed: restart it, or the game is stranded.
      this.store.setState(() => ({
        status: { kind: "engine-thinking", startedAt: Date.now() },
      }));
      this.startEngineSearch();
    }
  }

  clearPremoves() {
    this.store.setState(() => ({
      premoves: [],
    }));
  }

  setSelectedSquare(square: number | null) {
    this.store.setState(() => ({
      selectedSquare: square,
    }));
  }

  flipBoard() {
    this.store.setState((prev) => ({
      boardFlipped: !prev.boardFlipped,
    }));
  }

  setTheme(themeId: string) {
    if (THEMES[themeId]) {
      applyThemeToCss(THEMES[themeId]!);
      this.store.setState(() => ({
        theme: themeId,
      }));
    }
  }

  setMaxPremoves(maxPremoves: number) {
    this.store.setState(() => ({
      maxPremoves,
    }));
  }

  setBoardSize(boardSize: "compact" | "normal" | "large" | "full") {
    this.store.setState(() => ({
      boardSize,
    }));
  }
}
