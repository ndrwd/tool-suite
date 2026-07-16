import * as React from "react";

import { cn } from "./cn";
import { FieldLabel, fieldInputClass } from "./Field";
import { Chevron } from "./Panel";

export type SelectOption = { value: string; label: string };

/** Labeled native select with the shared disclosure chevron. Pass `label={false}` to omit the caption. */
export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label?: React.ReactNode | false;
  value: string;
  options: SelectOption[];
  onChange: (next: string) => void;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      {label !== false ? <FieldLabel>{label}</FieldLabel> : null}
      <div className="relative">
        <select
          className={cn(fieldInputClass, "appearance-none pr-7")}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
          <Chevron collapsed={false} />
        </span>
      </div>
    </label>
  );
}
