import * as React from "react";

import { cn } from "./cn";
import { ColorPicker } from "./ColorPicker";
import { FieldLabel, fieldInputClass } from "./Field";

/** Color row: square swatch/picker + hex field, full width. One style everywhere. */
export function ColorField({
  label,
  value,
  onChange,
}: {
  label?: React.ReactNode | false;
  value: string;
  onChange: (next: string) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      {label !== false ? <FieldLabel>{label}</FieldLabel> : null}
      <span className="flex items-center gap-2">
        <ColorPicker onChange={onChange} value={value} />
        <input
          aria-label={typeof label === "string" ? `${label} hex` : "hex"}
          className={cn(fieldInputClass, "h-8 py-0 font-mono uppercase")}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      </span>
    </div>
  );
}
