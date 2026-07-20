import * as React from "react";

import { cn } from "./cn";
import { Button as ShadcnButton } from "./ui/button";

/**
 * Shared button — the shadcn button on the `secondary` variant, full-width by
 * default (stacked panel actions). Pass `className` to override, or `variant`
 * to reach for the accent (`default`) or destructive treatments.
 */
export function Button({
  className,
  variant = "secondary",
  size = "sm",
  type = "button",
  ...props
}: React.ComponentPropsWithoutRef<typeof ShadcnButton>): React.JSX.Element {
  return (
    <ShadcnButton
      className={cn("w-full", className)}
      size={size}
      type={type}
      variant={variant}
      {...props}
    />
  );
}

/**
 * Borderless action for a section header (Reset, Restore, Add) — muted until
 * hovered, so it never competes with the section title next to it. Kept
 * bespoke: the shadcn `ghost` variant carries a button-sized hit area and
 * padding that would crowd a section header at this scale.
 */
export function SectionAction({
  className,
  type = "button",
  ...props
}: React.ComponentPropsWithoutRef<"button">): React.JSX.Element {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-2xs text-[var(--muted-foreground)] outline-none transition-colors",
        "hover:text-[var(--foreground)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-[var(--muted-foreground)]",
        className,
      )}
      type={type}
      {...props}
    />
  );
}
