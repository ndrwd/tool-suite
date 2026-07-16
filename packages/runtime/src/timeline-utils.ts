import type { TimelineState } from "./types";

function positiveModulo(value: number, modulo: number): number {
  return ((value % modulo) + modulo) % modulo;
}

/** Wrapped time within one loop, in seconds. */
export function getLoopTime(timeline: Pick<TimelineState, "currentTimeSeconds" | "durationSeconds">): number {
  const { currentTimeSeconds, durationSeconds } = timeline;

  if (!Number.isFinite(currentTimeSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }

  return positiveModulo(currentTimeSeconds, durationSeconds);
}

/** Loop progress in 0..1 across the timeline duration. */
export function getLoopProgress(timeline: Pick<TimelineState, "currentTimeSeconds" | "durationSeconds">): number {
  if (!Number.isFinite(timeline.durationSeconds) || timeline.durationSeconds <= 0) {
    return 0;
  }

  return getLoopTime(timeline) / timeline.durationSeconds;
}
