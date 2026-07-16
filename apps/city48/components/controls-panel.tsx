"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronLeft, ChevronRight, Plus, X, RotateCcw } from "lucide-react"
import { Chevron, SectionAction, Select, Slider, Toggle } from "@tools/ui"
import { SHADERS, getShader, type ShaderLayer } from "@/lib/shaders"

type Props = {
  layers: ShaderLayer[]
  selectedUid: string | null
  onSelectLayer: (uid: string) => void
  onAddLayer: () => void
  onRemoveLayer: (uid: string) => void
  onToggleLayer: (uid: string) => void
  onChangeShader: (uid: string, shaderId: string) => void
  onParamChange: (uid: string, key: string, value: number) => void
  onResetParams: (uid: string) => void
}

// Shared caption style — matches the design system (@tools/ui FieldLabel).
const caption = "text-2xs font-medium text-[var(--muted-foreground)]"

type LayerSectionProps = {
  layer: ShaderLayer
  onRemove: () => void
  onToggle: () => void
  onChangeShader: (shaderId: string) => void
  onParamChange: (key: string, value: number) => void
  onResetParams: () => void
}

function LayerSection({
  layer,
  onRemove,
  onToggle,
  onChangeShader,
  onParamChange,
  onResetParams,
}: LayerSectionProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const shader = getShader(layer.shaderId)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  function cycleShader(dir: 1 | -1) {
    const index = SHADERS.findIndex((s) => s.id === shader.id)
    const next = (index + dir + SHADERS.length) % SHADERS.length
    onChangeShader(SHADERS[next].id)
  }

  return (
    <section className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4 last:border-b-0">
      {/* Header row — click title to collapse/expand (unified with shape-morph) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <Chevron collapsed={collapsed} />
          <span
            className={`truncate text-2xs font-semibold tracking-wide ${
              layer.enabled ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)] line-through"
            }`}
          >
            {shader.name}
          </span>
        </button>
        <Toggle checked={layer.enabled} onChange={() => onToggle()} aria-label={`Toggle ${shader.name}`} />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${shader.name}`}
          className="shrink-0 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Body: shader chooser + parameters */}
      {!collapsed && (
        <div className="flex flex-col gap-4">
          <div ref={dropdownRef} className="relative flex items-stretch gap-2">
            <button
              type="button"
              aria-label="Previous shader"
              onClick={() => cycleShader(-1)}
              className="flex w-5 shrink-0 items-center justify-center rounded-md bg-[var(--secondary)] text-[var(--muted-foreground)] transition hover:text-[var(--foreground)] hover:brightness-110"
            >
              <ChevronLeft className="size-3" />
            </button>

            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md bg-[var(--secondary)] px-3 py-2 text-left transition hover:brightness-110"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium text-[var(--foreground)]">{shader.name}</span>
                <span className="truncate text-2xs text-[var(--muted-foreground)]">{shader.description}</span>
              </span>
              <Chevron collapsed={false} />
            </button>

            <button
              type="button"
              aria-label="Next shader"
              onClick={() => cycleShader(1)}
              className="flex w-5 shrink-0 items-center justify-center rounded-md bg-[var(--secondary)] text-[var(--muted-foreground)] transition hover:text-[var(--foreground)] hover:brightness-110"
            >
              <ChevronRight className="size-3" />
            </button>

            {open && (
              <div
                role="listbox"
                className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-[var(--border)] bg-[var(--popover)] p-1 shadow-lg"
              >
                {SHADERS.map((s) => {
                  const active = s.id === shader.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChangeShader(s.id)
                        setOpen(false)
                      }}
                      className={`flex w-full items-start gap-2 rounded-sm px-2.5 py-2 text-left transition-colors ${
                        active
                          ? "bg-[var(--secondary)] text-[var(--foreground)]"
                          : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      <Check className={`mt-0.5 size-3 shrink-0 ${active ? "opacity-100" : "opacity-0"}`} />
                      <span className="flex flex-col">
                        <span className="text-xs font-medium">{s.name}</span>
                        <span className="text-2xs text-[var(--muted-foreground)]">{s.description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <h3 className={caption}>Parameters</h3>
            <SectionAction onClick={onResetParams}>
              <RotateCcw className="size-3" />
              Reset
            </SectionAction>
          </div>

          <div className="flex flex-col gap-4">
            {shader.params.map((p) => {
              const value = layer.params[p.key] ?? p.default

              if (p.type === "toggle") {
                const on = value >= 0.5
                return (
                  <div key={p.key} className="flex items-center justify-between">
                    <span className={caption}>{p.label}</span>
                    <Toggle checked={on} onChange={(next) => onParamChange(p.key, next ? 1 : 0)} aria-label={p.label} />
                  </div>
                )
              }

              if (p.type === "select" && p.options?.length) {
                return (
                  <Select
                    key={p.key}
                    label={p.label}
                    value={String(value)}
                    options={p.options.map((option) => ({ value: String(option.value), label: option.label }))}
                    onChange={(next) => onParamChange(p.key, Number.parseFloat(next))}
                  />
                )
              }

              return (
                <Slider
                  key={p.key}
                  label={p.label}
                  value={value}
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  display={value.toFixed(p.step < 0.01 ? 3 : 2)}
                  onChange={(next) => onParamChange(p.key, next)}
                />
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

export function ControlsPanel({
  layers,
  onAddLayer,
  onRemoveLayer,
  onToggleLayer,
  onChangeShader,
  onParamChange,
  onResetParams,
}: Props) {
  return (
    <div className="flex flex-col">
      {/* Section header — full-bleed, matches other panel sections */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2 className={caption}>Effects</h2>
        <SectionAction onClick={onAddLayer}>
          <Plus className="size-3" />
          Add
        </SectionAction>
      </div>

      {layers.length === 0 ? (
        <p className="px-4 py-6 text-center text-2xs text-[var(--muted-foreground)]">
          No effects. Add one to start mixing.
        </p>
      ) : (
        layers.map((layer) => (
          <LayerSection
            key={layer.uid}
            layer={layer}
            onRemove={() => onRemoveLayer(layer.uid)}
            onToggle={() => onToggleLayer(layer.uid)}
            onChangeShader={(shaderId) => onChangeShader(layer.uid, shaderId)}
            onParamChange={(key, value) => onParamChange(layer.uid, key, value)}
            onResetParams={() => onResetParams(layer.uid)}
          />
        ))
      )}
    </div>
  )
}
