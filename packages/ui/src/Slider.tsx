import * as React from "react";

import { FieldLabel } from "./Field";

/** Labeled range slider with a right-aligned value read-out. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  display,
  onChange,
}: {
  label: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Override the numeric read-out (defaults to the raw value). */
  display?: string;
  onChange: (next: number) => void;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-2xs tabular-nums text-[var(--muted-foreground)]">
          {display ?? value}
          {unit ?? ""}
        </span>
      </span>
      <input
        className="ui-slider outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}
