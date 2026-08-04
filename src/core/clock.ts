import { ClockState, Color } from "./types";

/**
 * Chess clocks, as pure arithmetic over a `ClockState`.
 *
 * The state stores what each side had banked at the start of the current turn
 * plus when that turn began, and the remaining time is *derived* on read.
 * Nothing decrements on a timer: a counter driven by `setInterval` drifts, and
 * stops entirely when the tab is backgrounded, which is exactly when a player
 * most needs their flag to have fallen.
 */

export interface TimeControl {
  id: string;
  label: string;
  initialMs: number;
  incrementMs: number;
}

/**
 * `docs/04-game-core.md` leaves the presets open; these are the three shapes
 * people actually play — a fast game with an increment so it cannot be won on
 * the clock alone, and two plain ones.
 */
export const TIME_CONTROLS: TimeControl[] = [
  { id: "off", label: "No clock", initialMs: 0, incrementMs: 0 },
  { id: "3+2", label: "3 min + 2 sec", initialMs: 180_000, incrementMs: 2_000 },
  { id: "5+0", label: "5 min", initialMs: 300_000, incrementMs: 0 },
  { id: "10+0", label: "10 min", initialMs: 600_000, incrementMs: 0 },
];

export const DEFAULT_TIME_CONTROL_ID = "off";

export function timeControlById(id: string | undefined): TimeControl {
  return (
    TIME_CONTROLS.find((tc) => tc.id === id) ??
    TIME_CONTROLS.find((tc) => tc.id === DEFAULT_TIME_CONTROL_ID)!
  );
}

/** A clock for a game about to start, already running for the first mover. */
export function createClock(
  control: TimeControl,
  firstMover: Color,
  now: number,
): ClockState | undefined {
  if (control.initialMs <= 0) return undefined;
  return {
    initialMs: control.initialMs,
    incrementMs: control.incrementMs,
    remaining: { white: control.initialMs, black: control.initialMs },
    runningSince: now,
    runningFor: firstMover,
  };
}

/**
 * What `color` has left right now. Banked time, minus whatever has elapsed if
 * the clock is currently running for them.
 */
export function remainingFor(
  clock: ClockState,
  color: Color,
  now: number,
): number {
  const banked = clock.remaining[color];
  if (clock.runningFor !== color || clock.runningSince === null) return banked;
  return Math.max(0, banked - (now - clock.runningSince));
}

export function opposite(color: Color): Color {
  return color === "white" ? "black" : "white";
}

/**
 * Ends the mover's turn and starts their opponent's.
 *
 * The increment lands on move *completion*, not on move start — the time you
 * are given is for the move you made, so a player who flags mid-thought does
 * not get bailed out by an increment they never earned.
 */
export function switchTurn(clock: ClockState, now: number): ClockState {
  const mover = clock.runningFor;
  if (mover === null) return clock;

  const left = remainingFor(clock, mover, now);
  const next = opposite(mover);

  return {
    ...clock,
    remaining: {
      ...clock.remaining,
      // A player who has already run out gains nothing by finishing a move.
      [mover]: left > 0 ? left + clock.incrementMs : 0,
    },
    runningSince: now,
    runningFor: next,
  };
}

/** Freezes the clock where it stands. Used when the game ends. */
export function stopClock(clock: ClockState, now: number): ClockState {
  const mover = clock.runningFor;
  if (mover === null) return clock;
  return {
    ...clock,
    remaining: { ...clock.remaining, [mover]: remainingFor(clock, mover, now) },
    runningSince: null,
    runningFor: null,
  };
}

/** The side whose flag has fallen, or null. Only the side to move can flag. */
export function flaggedColor(clock: ClockState, now: number): Color | null {
  const mover = clock.runningFor;
  if (mover === null) return null;
  return remainingFor(clock, mover, now) <= 0 ? mover : null;
}
