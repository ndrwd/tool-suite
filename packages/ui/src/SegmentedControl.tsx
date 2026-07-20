import * as React from "react";

import { cn } from "./cn";

export type SegmentedOption<T extends string | number> = {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
};

/**
 * Segmented control — every option sits on a recessed track and the selected
 * one lifts out of it on the `--primary` accent. Three surfaces, so the group
 * reads as a group: panel (--card) < track (--secondary) < selected (primary).
 */
export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (next: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  "aria-label"?: string;
}): React.JSX.Element {
  return (
    <div aria-label={ariaLabel} className={cn("flex rounded-md bg-[var(--secondary)] p-0.5", className)} role="group">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            aria-pressed={active}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-2xs font-semibold outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
              active
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
