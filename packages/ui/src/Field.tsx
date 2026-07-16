import * as React from "react";

import { cn } from "./cn";

/** Small uppercase caption used above every control. */
export function FieldLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="text-2xs font-medium text-[var(--muted-foreground)]">
      {children}
    </span>
  );
}

/** Shared visual style for text/number/select inputs. Exported for one-off inputs. */
export const fieldInputClass =
  "w-full rounded-md border border-transparent bg-[var(--secondary)] px-2 py-1.5 text-xs text-[var(--foreground)] outline-none transition hover:brightness-110 focus:border-[var(--foreground)] focus-visible:ring-1 focus-visible:ring-[var(--ring)]";

/** Styled `<input>` that forwards all native props (type, min, value, …). */
export function TextInput({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"input">): React.JSX.Element {
  return <input className={cn(fieldInputClass, className)} {...props} />;
}
