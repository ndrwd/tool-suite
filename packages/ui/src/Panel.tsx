import * as React from "react";

import { cn } from "./cn";

/** Rotating disclosure chevron. */
export function Chevron({ collapsed }: { collapsed: boolean }): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className={`h-3 w-3 shrink-0 text-[var(--muted-foreground)] transition-transform ${collapsed ? "-rotate-90" : "rotate-0"}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * Collapsible titled section. When `headerAccessory` is provided it renders
 * between the title and a standalone chevron (e.g. a section on/off toggle);
 * otherwise the title row itself carries the chevron.
 */
export function CollapsibleSection({
  title,
  headerAccessory,
  defaultCollapsed = false,
  sticky = false,
  noBottomBorder = false,
  children,
}: {
  title: React.ReactNode;
  headerAccessory?: React.ReactNode;
  defaultCollapsed?: boolean;
  /** Pin to the bottom of the scroll container; other sections scroll under it. */
  sticky?: boolean;
  /** Drop the bottom divider (e.g. the section right before a sticky footer). */
  noBottomBorder?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);
  const toggle = (): void => setCollapsed((value) => !value);

  return (
    <section
      className={cn(
        "flex flex-col gap-3 px-4 py-4",
        sticky
          ? "sticky bottom-0 z-10 border-t border-[var(--border)] bg-[var(--card)]"
          : noBottomBorder
            ? ""
            : "border-b border-[var(--border)] last:border-b-0",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          aria-expanded={!collapsed}
          className="flex flex-1 items-center gap-1.5 text-left text-2xs font-semibold tracking-wide text-[var(--foreground)]"
          onClick={toggle}
          type="button"
        >
          <Chevron collapsed={collapsed} />
          {title}
        </button>
        {headerAccessory ?? null}
      </div>
      <div className={collapsed ? "hidden" : "flex flex-col gap-3"}>{children}</div>
    </section>
  );
}

/** Right-hand controls panel shell with a sticky title header. */
export function Panel({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--card)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <h1 className="text-sm font-semibold text-[var(--foreground)]">{title}</h1>
      </header>
      {children}
    </aside>
  );
}
