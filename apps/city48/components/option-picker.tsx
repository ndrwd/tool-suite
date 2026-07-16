"use client"

import { useEffect, useRef, useState } from "react"
import { Check } from "lucide-react"
import { Chevron } from "@tools/ui"

export type PickerOption = {
  value: string
  title: string
  /** Second line — what the option is, or what it is made of. */
  description?: string
}

/**
 * Two-line dropdown in the panel's own styling. A native <select> renders its
 * list with the OS chrome, which ignores the theme and can only show one line
 * per option — this needs both a title and a description, so it is hand-built.
 */
export function OptionPicker({
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
  className,
}: {
  value: string
  options: PickerOption[]
  onChange: (next: string) => void
  "aria-label"?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md bg-[var(--secondary)] px-3 py-2 text-left outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-xs font-medium text-[var(--foreground)]">{selected?.title ?? value}</span>
          {selected?.description ? (
            <span className="truncate text-2xs text-[var(--muted-foreground)]">{selected.description}</span>
          ) : null}
        </span>
        <Chevron collapsed={false} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--popover)] p-1 shadow-lg"
        >
          {options.map((option) => {
            const active = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex w-full items-start gap-2 rounded-sm px-2.5 py-2 text-left transition-colors ${
                  active
                    ? "bg-[var(--secondary)] text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                }`}
              >
                <Check className={`mt-0.5 size-3 shrink-0 ${active ? "opacity-100" : "opacity-0"}`} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs font-medium">{option.title}</span>
                  {option.description ? (
                    <span className="text-2xs text-[var(--muted-foreground)]">{option.description}</span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
