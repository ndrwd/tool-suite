import * as React from "react";

import { FieldLabel } from "./Field";
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export type SelectOption = { value: string; label: string };

/**
 * Labeled select on the shadcn/Base UI listbox. Pass `label={false}` to omit the
 * caption. The `value + options + onChange` API is the suite's — the
 * schema-driven panels in @tools/runtime pass plain option arrays.
 *
 * A `<label>` wrapper would steal the click from the trigger button, so the
 * caption sits beside it rather than wrapping it.
 */
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
    <div className="flex flex-col gap-1.5">
      {label !== false ? <FieldLabel>{label}</FieldLabel> : null}
      <ShadcnSelect
        items={options}
        onValueChange={(next) => onChange(String(next))}
        value={value}
      >
        <SelectTrigger className="h-8 w-full text-xs" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </ShadcnSelect>
    </div>
  );
}
