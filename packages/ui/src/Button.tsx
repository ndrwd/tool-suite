import * as React from "react";

import { cn } from "./cn";

/**
 * Shared button — monochrome, gray fill. One button style across every tool.
 * Full-width by default (stacked panel actions); pass `className` to override.
 */
export function Button({
  className,
  type = "button",
  ...props
}: React.ComponentPropsWithoutRef<"button">): React.JSX.Element {
  return (
    <button
      className={cn(
        "inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-3 py-2 text-xs font-medium text-[var(--foreground)] outline-none transition-colors",
        "hover:border-[var(--muted-foreground)] hover:bg-[var(--muted)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:bg-[var(--secondary)]",
        className,
      )}
      type={type}
      {...props}
    />
  );
}
