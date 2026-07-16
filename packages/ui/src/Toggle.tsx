import * as React from "react";

import { cn } from "./cn";

/** Pill on/off toggle. */
export function Toggle({
  checked,
  onChange,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  "aria-label"?: string;
}): React.JSX.Element {
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={checked}
      className={cn(
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full px-0.5 outline-none transition hover:brightness-110",
        "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        checked ? "bg-[var(--foreground)]" : "bg-[color-mix(in_oklab,var(--foreground)_24%,transparent)]",
      )}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span
        className={cn(
          "h-4 w-4 rounded-full shadow-sm transition-transform",
          checked ? "translate-x-4 bg-[var(--background)]" : "translate-x-0 bg-[var(--foreground)]",
        )}
      />
    </button>
  );
}
