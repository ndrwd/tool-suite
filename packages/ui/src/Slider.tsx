import * as React from "react";

import { FieldLabel } from "./Field";
import { Slider as ShadcnSlider } from "./ui/slider";

/**
 * Labeled slider with a right-aligned value read-out.
 *
 * The control itself is the shadcn/Base UI slider, so it renders identically on
 * every OS (a native `<input type="range">` does not) and the filled part of the
 * track carries the `--primary` accent. The label/read-out row and the
 * `label + value + onChange` API are ours — the schema-driven panels in
 * @tools/runtime depend on them.
 */
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
      <ShadcnSlider
        max={max}
        min={min}
        // Base UI reports `number | number[]` depending on thumb count; this
        // slider is always single-thumb.
        onValueChange={(next) => onChange(Array.isArray(next) ? (next[0] ?? min) : next)}
        step={step}
        value={value}
      />
    </label>
  );
}
