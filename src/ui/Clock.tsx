import { useEffect, useState } from "react";
import { Color } from "../core/types";
import { remainingFor } from "../core/clock";
import { useGameStore } from "../store";

interface ClockProps {
  color: Color;
}

/**
 * A bare time readout. The player row around it already says whose clock this
 * is, so the label and frame the standalone widget used to carry would be
 * saying it twice.
 *
 * Renders nothing when the game has no time control. The interval only decides
 * how often to repaint — the value is derived from a monotonic clock on every
 * read, so it neither drifts nor stalls when the tab is backgrounded.
 */
export function Clock({ color }: ClockProps) {
  const clockState = useGameStore((s) => s.clock);
  const [timeMs, setTimeMs] = useState(
    clockState ? clockState.remaining[color] : 0,
  );

  useEffect(() => {
    if (!clockState) return;

    const tick = () =>
      setTimeMs(remainingFor(clockState, color, performance.now()));

    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [clockState, color]);

  if (!clockState) return null;

  const totalSec = Math.ceil(timeMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const isRunning = clockState.runningFor === color;
  const isLow = totalSec <= 30;

  return (
    <span
      style={{
        fontFamily: "var(--font-data)",
        /*
         * Stays at --data while it shares a line with the 11px detail text.
         * It goes to --data-lg when it becomes a readout of its own on the
         * deck; at 33px it would blow out the row it currently sits in.
         */
        fontSize: "var(--data)",
        lineHeight: "var(--lh-data)",
        fontVariantNumeric: "tabular-nums",
        color: isLow
          ? "var(--error)"
          : isRunning
            ? "var(--text)"
            : "var(--text-faint)",
        transition: "color var(--dur-base) ease",
      }}
    >
      {min}:{sec < 10 ? "0" : ""}
      {sec}
    </span>
  );
}
