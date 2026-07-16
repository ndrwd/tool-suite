"use client"

import { ChevronLeft, ChevronRight, Plus, X, RotateCcw } from "lucide-react"
import {
  CollapsibleSection,
  ColorField,
  FieldLabel,
  SectionAction,
  Select,
  Slider,
  Toggle,
  fieldLabelClass,
} from "@tools/ui"
import { SHADERS, getShader, type Rgb, type ShaderLayer } from "@/lib/shaders"
import { hexToRgb, rgbToHex } from "@/lib/utils"
import { MANUAL_PRESET, PRESETS, presetModules } from "@/lib/presets"
import { OptionPicker } from "@/components/option-picker"

type Props = {
  layers: ShaderLayer[]
  selectedUid: string | null
  onSelectLayer: (uid: string) => void
  onAddLayer: () => void
  onRemoveLayer: (uid: string) => void
  onToggleLayer: (uid: string) => void
  onChangeShader: (uid: string, shaderId: string) => void
  onParamChange: (uid: string, key: string, value: number) => void
  onColorChange: (uid: string, key: string, value: Rgb) => void
  onResetParams: (uid: string) => void
  onApplyPreset: (presetId: string) => void
  onResetEffects: () => void
  activePresetId: string
}

type LayerSectionProps = {
  layer: ShaderLayer
  onRemove: () => void
  onToggle: () => void
  onChangeShader: (shaderId: string) => void
  onParamChange: (key: string, value: number) => void
  onColorChange: (key: string, value: Rgb) => void
  onResetParams: () => void
}

function LayerSection({
  layer,
  onRemove,
  onToggle,
  onChangeShader,
  onParamChange,
  onColorChange,
  onResetParams,
}: LayerSectionProps) {
  const shader = getShader(layer.shaderId)

  function cycleShader(dir: 1 | -1) {
    const index = SHADERS.findIndex((s) => s.id === shader.id)
    const next = (index + dir + SHADERS.length) % SHADERS.length
    onChangeShader(SHADERS[next].id)
  }

  return (
    <CollapsibleSection
      headerAccessory={
        <>
          <Toggle checked={layer.enabled} onChange={() => onToggle()} aria-label={`Toggle ${shader.name}`} />
          <SectionAction onClick={onRemove} aria-label={`Remove ${shader.name}`}>
            <X className="size-3.5" />
          </SectionAction>
        </>
      }
      title={
        <span className={`truncate ${layer.enabled ? "" : "text-[var(--muted-foreground)] line-through"}`}>
          {shader.name}
        </span>
      }
    >
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-label="Previous shader"
          onClick={() => cycleShader(-1)}
          className="flex w-5 shrink-0 items-center justify-center rounded-md bg-[var(--secondary)] text-[var(--muted-foreground)] transition hover:text-[var(--foreground)] hover:brightness-110"
        >
          <ChevronLeft className="size-3" />
        </button>

        <OptionPicker
          aria-label="Shader"
          className="min-w-0 flex-1"
          value={shader.id}
          options={SHADERS.map((s) => ({ value: s.id, title: s.name, description: s.description }))}
          onChange={onChangeShader}
        />

        <button
          type="button"
          aria-label="Next shader"
          onClick={() => cycleShader(1)}
          className="flex w-5 shrink-0 items-center justify-center rounded-md bg-[var(--secondary)] text-[var(--muted-foreground)] transition hover:text-[var(--foreground)] hover:brightness-110"
        >
          <ChevronRight className="size-3" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h3 className={fieldLabelClass}>Parameters</h3>
        <SectionAction onClick={onResetParams}>
          <RotateCcw className="size-3" />
          Reset
        </SectionAction>
      </div>

      <div className="flex flex-col gap-3">
        {shader.params.map((p) => {
          const value = layer.params[p.key] ?? p.default

          if (p.type === "toggle") {
            const on = value >= 0.5
            return (
              <div key={p.key} className="flex items-center justify-between">
                <FieldLabel>{p.label}</FieldLabel>
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

        {shader.colors?.map((c) => (
          <ColorField
            key={c.key}
            label={c.label}
            value={rgbToHex(layer.colors[c.key] ?? c.default)}
            onChange={(next) => {
              const rgb = hexToRgb(next)
              if (rgb) onColorChange(c.key, rgb)
            }}
          />
        ))}
      </div>
    </CollapsibleSection>
  )
}

export function ControlsPanel({
  layers,
  onAddLayer,
  onRemoveLayer,
  onToggleLayer,
  onChangeShader,
  onParamChange,
  onColorChange,
  onResetParams,
  onApplyPreset,
  onResetEffects,
  activePresetId,
}: Props) {
  return (
    <div className="flex flex-col">
      {/* Preset — a whole stack in one pick, above the effects it produces */}
      <section className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4">
        <FieldLabel>Preset</FieldLabel>
        <OptionPicker
          aria-label="Preset"
          value={activePresetId}
          options={[
            { value: MANUAL_PRESET, title: "Manual", description: "No preset — your own stack of effects" },
            ...PRESETS.map((preset) => ({
              value: preset.id,
              title: preset.name,
              description: presetModules(preset),
            })),
          ]}
          onChange={onApplyPreset}
        />
      </section>

      {/* Section header — full-bleed, matches other panel sections */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h2 className={fieldLabelClass}>Effects</h2>
        <span className="flex items-center gap-3">
          <SectionAction onClick={onResetEffects} disabled={layers.length === 0}>
            <RotateCcw className="size-3" />
            Reset
          </SectionAction>
          <SectionAction onClick={onAddLayer}>
            <Plus className="size-3" />
            Add
          </SectionAction>
        </span>
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
            onColorChange={(key, value) => onColorChange(layer.uid, key, value)}
            onResetParams={() => onResetParams(layer.uid)}
          />
        ))
      )}
    </div>
  )
}
