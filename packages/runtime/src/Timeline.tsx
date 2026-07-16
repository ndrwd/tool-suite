import * as React from "react";

import { useStore } from "./store";
import { getLoopTime } from "./timeline-utils";

export function Timeline(): React.JSX.Element {
  const { state, setPlaying, seek, setDuration } = useStore();
  const { durationSeconds, playing } = state.timeline;
  const loopTime = getLoopTime(state.timeline);

  return (
    <div className="m-3 flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 shadow-sm">
      <button
        aria-label={playing ? "Pause" : "Play"}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--foreground)] outline-none transition-colors hover:bg-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        onClick={() => setPlaying(!playing)}
        type="button"
      >
        {playing ? (
          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6.5" y="5" width="3.5" height="14" rx="1.25" />
            <rect x="14" y="5" width="3.5" height="14" rx="1.25" />
          </svg>
        ) : (
          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.29-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z" />
          </svg>
        )}
      </button>

      <span className="w-10 shrink-0 text-2xs tabular-nums text-[var(--muted-foreground)]">{loopTime.toFixed(1)}s</span>

      <input
        aria-label="Scrub timeline"
        className="ui-slider flex-1 outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        max={durationSeconds}
        min={0}
        onChange={(event) => {
          setPlaying(false);
          seek(Number(event.target.value));
        }}
        step={0.01}
        type="range"
        value={loopTime}
      />

      <label className="flex shrink-0 items-center gap-1.5 text-2xs text-[var(--muted-foreground)]">
        Loop
        <input
          className="w-14 rounded-md border border-transparent bg-[var(--secondary)] px-1.5 py-1 text-xs text-[var(--foreground)] outline-none transition hover:brightness-110 focus:border-[var(--foreground)]"
          max={60}
          min={1}
          onChange={(event) => setDuration(Number(event.target.value))}
          step={0.5}
          type="number"
          value={durationSeconds}
        />
        s
      </label>
    </div>
  );
}
