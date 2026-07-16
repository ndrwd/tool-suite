import * as React from "react";
import { Toaster } from "sonner";

import { ControlsPanel } from "./ControlsPanel";
import { StoreProvider, useStore } from "./store";
import { Timeline } from "./Timeline";
import type { AppSchema } from "./schema";
import type { AppState } from "./types";

export type ToolActionHandler = (value: string, state: AppState) => void;

function ToolShell({
  schema,
  renderer,
  onAction,
}: {
  schema: AppSchema;
  renderer: React.ReactNode;
  onAction?: ToolActionHandler;
}): React.JSX.Element {
  const { state } = useStore();

  const handleAction = React.useCallback((value: string): void => onAction?.(value, state), [onAction, state]);

  return (
    <div className="flex h-dvh min-h-dvh bg-[var(--background)]">
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6">{renderer}</main>
        <Timeline />
      </div>
      <ControlsPanel onAction={handleAction} schema={schema} />
      <Toaster position="bottom-center" theme={state.theme} />
    </div>
  );
}

/**
 * Full tool shell: schema-driven controls panel, timeline transport, canvas
 * slot, and export toasts. A tool supplies its `schema`, a `renderer` (its
 * canvas component), a `storageKey` for persistence, and an optional `onAction`
 * handler for panel actions (export, etc.).
 */
export function ToolApp({
  schema,
  storageKey,
  renderer,
  onAction,
}: {
  schema: AppSchema;
  storageKey: string;
  renderer: React.ReactNode;
  onAction?: ToolActionHandler;
}): React.JSX.Element {
  return (
    <StoreProvider schema={schema} storageKey={storageKey}>
      <ToolShell onAction={onAction} renderer={renderer} schema={schema} />
    </StoreProvider>
  );
}
