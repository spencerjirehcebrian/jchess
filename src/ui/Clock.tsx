import { useEffect, useState } from "react";
import { Color } from "../core/types";
import { useGameStore } from "../store";

interface ClockProps {
  color: Color;
}

/**
 * A bare time readout. The player row around it already says whose clock this
 * is, so the label and frame the standalone widget used to carry would be
 * saying it twice.
 *
 * Renders nothing until something drives `state.clock`. No time control is
 * implemented yet — the slot exists so one can be added without moving the
 * layout around it.
 */
export function Clock({ color }: ClockProps) {
  const clockState = useGameStore((s) => s.clock);
  const [timeMs, setTimeMs] = useState(
    clockState ? clockState.remaining[color] : 0,
  );

  useEffect(() => {
    if (!clockState) return;

    const tick = () => {
      let remaining = clockState.remaining[color];
      if (clockState.runningFor === color && clockState.runningSince !== null) {
        const elapsed = performance.now() - clockState.runningSince;
        remaining = Math.max(0, remaining - elapsed);
      }
      setTimeMs(remaining);
    };

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
        fontFamily: "var(--font-mono)",
        fontSize: "var(--size-lg)",
        lineHeight: 1,
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
