import React, { useState, useEffect } from "react";
import { useGameStore } from "../store";
import { GameController } from "../store/controller";
import { createStockfishEngine } from "../engine/stockfish";
import { positionAfter, fromSan } from "../core/rules";

export function DevConsole() {
  const state = useGameStore();
  const [controller, setController] = useState<GameController | null>(null);
  const [inputMove, setInputMove] = useState("");

  useEffect(() => {
    const storeObj = useGameStore.getState();
    const engine = createStockfishEngine();
    const ctrl = new GameController(storeObj, engine);
    setController(ctrl);

    engine
      .init()
      .then(() => {
        ctrl.startNewGame();
      })
      .catch(console.error);

    return () => {
      engine.dispose();
    };
  }, []);

  const currentPos = positionAfter(
    state.initialFen,
    state.history.map((h) => h.move),
  );

  const currentFen =
    state.history.length > 0
      ? state.history[state.history.length - 1]!.fenAfter
      : state.initialFen;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!controller || !inputMove.trim()) return;

    const parsed = fromSan(currentPos, inputMove.trim());
    if (parsed && controller.makeMove(parsed)) {
      setInputMove("");
    } else {
      alert(`Invalid move: ${inputMove}`);
    }
  };

  return (
    <div
      style={{ padding: "1.5rem", fontFamily: "monospace", maxWidth: "600px" }}
    >
      <h2>Voxel Chess — M1 Dev Console</h2>
      <div
        style={{
          margin: "1rem 0",
          background: "#23272c",
          padding: "1rem",
          borderRadius: "4px",
        }}
      >
        <p>
          <strong>Status:</strong> {state.status.kind}
        </p>
        <p>
          <strong>FEN:</strong> {currentFen}
        </p>
        <p>
          <strong>Difficulty:</strong> {state.difficulty}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          value={inputMove}
          onChange={(e) => setInputMove(e.target.value)}
          placeholder="Enter move in SAN (e.g. e4, Nf3)"
          style={{
            padding: "0.5rem",
            width: "70%",
            background: "#2c3138",
            border: "1px solid #4a525c",
            color: "#fff",
          }}
        />
        <button
          type="submit"
          style={{
            padding: "0.5rem 1rem",
            marginLeft: "0.5rem",
            background: "#8fa89b",
            color: "#1a1d21",
            fontWeight: "bold",
          }}
        >
          Move
        </button>
      </form>

      <div style={{ marginBottom: "1rem" }}>
        <button
          onClick={() => controller?.takeback()}
          style={{ padding: "0.4rem 0.8rem", marginRight: "0.5rem" }}
        >
          Takeback
        </button>
        <button
          onClick={() => controller?.startNewGame()}
          style={{ padding: "0.4rem 0.8rem" }}
        >
          New Game
        </button>
      </div>

      <h3>Move List</h3>
      <ol style={{ paddingLeft: "1.5rem" }}>
        {state.history.map((h, i) => (
          <li key={i}>{h.san}</li>
        ))}
      </ol>
    </div>
  );
}
