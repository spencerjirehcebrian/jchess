import { Store } from "./index";
import { Move, Color, AppError, GameState } from "../core/types";
import { Engine } from "../engine/types";
import {
  positionAfter,
  isLegal,
  toSan,
  outcome,
  toUci,
  fromUci,
  toFen,
} from "../core/rules";
import { getDifficulty } from "../core/difficulty";
import { audioEngine } from "../audio";
import { getConfig } from "../config";
import { THEMES, applyThemeToCss } from "../render/voxel/palette";

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

  constructor(store: Store, engine?: Engine) {
    this.store = store;
    if (engine) {
      this.engine = engine;
    }
  }

  setEngine(engine: Engine) {
    this.engine = engine;
  }

  startNewGame(options?: {
    humanColor?: Color;
    difficulty?: number;
    initialFen?: string;
  }) {
    const config = getConfig();
    const humanColor = options?.humanColor ?? "white";
    const difficulty = options?.difficulty ?? this.state.difficulty ?? config.defaultDifficulty;
    const initialFen = options?.initialFen ?? this.state.initialFen;

    const newStatus =
      humanColor === "white"
        ? ({ kind: "human-turn" } as const)
        : ({ kind: "engine-thinking", startedAt: Date.now() } as const);

    this.store.setState(() => ({
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
      this.triggerEngineSearch();
    }
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
      // Add to premove queue if within maxPremoves limit
      const config = getConfig();
      const maxPremoves = state.maxPremoves ?? config.maxPremoves;
      if (state.premoves.length < maxPremoves) {
        audioEngine.playSound("premove");
        this.store.setState((prev) => ({
          premoves: [...prev.premoves, move],
        }));
        return true;
      }
      return false;
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

    const sanStr = toSan(currentPos, move);
    const posAfter = positionAfter(state.initialFen, [
      ...state.history.map((h) => h.move),
      move,
    ]);
    const fenAfterStr = toFen(posAfter);
    const isCheck = posAfter.isCheck();
    const isMate = posAfter.isEnd() && isCheck;
    const captured = currentPos.board.get(move.to)?.role;

    const newHistory = [
      ...state.history,
      {
        move,
        san: sanStr,
        fenAfter: fenAfterStr,
        captured,
        isCheck,
        isMate,
      },
    ];

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

    if (isCheck) audioEngine.playSound("check");
    else if (captured) audioEngine.playSound("capture");
    else audioEngine.playSound("move");

    this.store.setState(() => ({
      history: newHistory,
      cursor: newHistory.length,
      status: { kind: "engine-thinking", startedAt: Date.now() },
      selectedSquare: null,
    }));

    this.triggerEngineSearch();
    return true;
  }

  private async triggerEngineSearch() {
    if (!this.engine) return;

    const state = this.state;
    const level = getDifficulty(state.difficulty);
    const currentMoves = state.history.map((h) => toUci(h.move));

    if (level.uciOptions) {
      await this.engine.setOptions(level.uciOptions);
    }

    const startTime = performance.now();

    try {
      const searchResult = await this.engine.search(
        state.initialFen,
        currentMoves,
        level.budget,
      );

      const elapsed = performance.now() - startTime;
      const [minThink, maxThink] = level.thinkTimeFloorMs;
      const targetThink =
        minThink + Math.floor(Math.random() * (maxThink - minThink + 1));
      const delayMs = level.id === 8 ? 0 : Math.max(0, targetThink - elapsed);

      const parsedMove = fromUci(searchResult.move);
      const currentPos = positionAfter(
        state.initialFen,
        state.history.map((h) => h.move),
      );

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

      if (delayMs > 0) {
        this.store.setState(() => ({
          status: {
            kind: "engine-delaying",
            move: parsedMove,
            until: Date.now() + delayMs,
          },
        }));
        await new Promise((r) => setTimeout(r, delayMs));
        if (this.state.status.kind !== "engine-delaying") {
          return;
        }
      }

      this.applyEngineMove(parsedMove);
    } catch (err: unknown) {
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
    const currentPos = positionAfter(
      state.initialFen,
      state.history.map((h) => h.move),
    );
    const sanStr = toSan(currentPos, move);
    const posAfter = positionAfter(state.initialFen, [
      ...state.history.map((h) => h.move),
      move,
    ]);
    const fenAfterStr = toFen(posAfter);
    const isCheck = posAfter.isCheck();
    const isMate = posAfter.isEnd() && isCheck;
    const captured = currentPos.board.get(move.to)?.role;

    const newHistory = [
      ...state.history,
      {
        move,
        san: sanStr,
        fenAfter: fenAfterStr,
        captured,
        isCheck,
        isMate,
      },
    ];

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

    if (isCheck) audioEngine.playSound("check");
    else if (captured) audioEngine.playSound("capture");
    else audioEngine.playSound("move");

    // Drain premove queue
    if (state.premoves.length > 0) {
      const [headPremove, ...tailPremoves] = state.premoves;
      if (headPremove && isLegal(posAfter, headPremove)) {
        // Head premove is legal: apply it
        const premoveSan = toSan(posAfter, headPremove);
        const posAfterPremove = positionAfter(state.initialFen, [
          ...newHistory.map((h) => h.move),
          headPremove,
        ]);
        const premoveFenAfter = toFen(posAfterPremove);
        const premoveCheck = posAfterPremove.isCheck();
        const premoveMate = posAfterPremove.isEnd() && premoveCheck;
        const premoveCaptured = posAfter.board.get(headPremove.to)?.role;

        const historyWithPremove = [
          ...newHistory,
          {
            move: headPremove,
            san: premoveSan,
            fenAfter: premoveFenAfter,
            captured: premoveCaptured,
            isCheck: premoveCheck,
            isMate: premoveMate,
          },
        ];

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

        if (premoveCheck) audioEngine.playSound("check");
        else if (premoveCaptured) audioEngine.playSound("capture");
        else audioEngine.playSound("move");

        this.store.setState(() => ({
          history: historyWithPremove,
          cursor: historyWithPremove.length,
          status: { kind: "engine-thinking", startedAt: Date.now() },
          premoves: tailPremoves,
        }));

        this.triggerEngineSearch();
        return;
      } else {
        // Head premove illegal: clear entire queue
        this.store.setState(() => ({
          history: newHistory,
          cursor: newHistory.length,
          status: { kind: "human-turn" },
          premoves: [],
        }));
        return;
      }
    }

    this.store.setState(() => ({
      history: newHistory,
      cursor: newHistory.length,
      status: { kind: "human-turn" },
    }));
  }

  takeback() {
    if (this.engine) {
      this.engine.stop();
    }

    const state = this.state;
    if (state.history.length === 0) return;

    // Remove 2 plies if human vs engine, or 1 if only 1 ply exists
    const pliesToRemove = state.history.length >= 2 ? 2 : 1;
    const newHistory = state.history.slice(
      0,
      state.history.length - pliesToRemove,
    );

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
    this.store.setState(() => ({
      cursor: clampedIndex,
      premoves: [],
    }));
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
