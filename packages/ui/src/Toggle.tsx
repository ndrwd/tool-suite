import * as React from "react";

import { Switch } from "./ui/switch";

/**
 * Pill on/off toggle — the shadcn/Base UI switch behind the suite's
 * `checked + onChange` API. The on state fills with `--primary`.
 */
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
    <Switch
      aria-label={ariaLabel}
      checked={checked}
      onCheckedChange={(next) => onChange(next)}
      size="sm"
    />
  );
}
