"use client"

import { useEffect, useRef, useState } from "react"
import { ImageIcon, Video, RotateCcw } from "lucide-react"
import {
  CollapsibleSection,
  FieldLabel,
  SectionAction,
  SegmentedControl,
  TextInput,
  type SegmentedOption,
} from "@tools/ui"
import type { CanvasSettings } from "@/lib/renderer"

type Props = {
  mediaKind: "image" | "video" | null
  previewUrl: string | null
  originalSize: { width: number; height: number } | null
  settings: CanvasSettings | null
  onChange: (patch: Partial<CanvasSettings>) => void
  onReset: () => void
  onPickMedia: (type: "image" | "video") => void
  bgPreviewUrl: string | null
  onPickBgImage: () => void
}

function toHex(c: [number, number, number]) {
  return (
    "#" +
    c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("")
  )
}

function fromHex(hex: string): [number, number, number] {
  const n = hex.replace("#", "")
  return [
    Number.parseInt(n.slice(0, 2), 16) / 255,
    Number.parseInt(n.slice(2, 4), 16) / 255,
    Number.parseInt(n.slice(4, 6), 16) / 255,
  ]
}

const BG_MODES: SegmentedOption<0 | 1 | 2>[] = [
  { value: 0, label: "None" },
  { value: 1, label: "Color" },
  { value: 2, label: "Image" },
]

const MEDIA_TABS: SegmentedOption<"image" | "video">[] = [
  { value: "image", label: "Image", icon: <ImageIcon className="size-3.5" /> },
  { value: "video", label: "Video", icon: <Video className="size-3.5" /> },
]

export function MediaPanel({
  mediaKind,
  previewUrl,
  originalSize,
  settings,
  onChange,
  onReset,
  onPickMedia,
  bgPreviewUrl,
  onPickBgImage,
}: Props) {
  const padRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const [widthStr, setWidthStr] = useState("")
  const [heightStr, setHeightStr] = useState("")
  const [zoomStr, setZoomStr] = useState("")

  useEffect(() => {
    if (settings) setWidthStr(String(Math.round(settings.width)))
  }, [settings?.width])
  useEffect(() => {
    if (settings) setHeightStr(String(Math.round(settings.height)))
  }, [settings?.height])
  useEffect(() => {
    if (settings) setZoomStr(settings.zoom.toFixed(2))
  }, [settings?.zoom])

  function commitZoom(raw: string) {
    const n = Number.parseFloat(raw)
    if (Number.isFinite(n)) onChange({ zoom: Math.max(0.2, Math.min(4, n)) })
  }

  const activeTab = mediaKind ?? "image"

  function commitSize(key: "width" | "height", raw: string) {
    const n = Number.parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 1) onChange({ [key]: n } as Partial<CanvasSettings>)
  }

  function handlePad(e: React.PointerEvent) {
    if (!padRef.current || !settings) return
    const rect = padRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const offsetX = Math.max(-1, Math.min(1, x * 2 - 1))
    const offsetY = Math.max(-1, Math.min(1, (1 - y) * 2 - 1))
    onChange({ offsetX, offsetY })
  }

  const handleX = settings ? (settings.offsetX * 0.5 + 0.5) * 100 : 50
  const handleY = settings ? (0.5 - settings.offsetY * 0.5) * 100 : 50

  return (
    <>
      {/* Media type — its own section, divided from Canvas */}
      <section className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4">
        <div className="flex items-center gap-3">
          <SegmentedControl
            aria-label="Media type"
            className="flex-1"
            onChange={onPickMedia}
            options={MEDIA_TABS}
            value={activeTab}
          />

          <div className="size-9 shrink-0 overflow-hidden rounded-md bg-[var(--muted)]">
            {previewUrl && mediaKind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl || "/placeholder.svg"} alt="Current media preview" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-[var(--muted-foreground)]">
                {mediaKind === "video" ? <Video className="size-4" /> : <ImageIcon className="size-4" />}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Canvas settings — its own section */}
      <CollapsibleSection
        defaultCollapsed
        headerAccessory={
          <SectionAction onClick={onReset}>
            <RotateCcw className="size-3" />
            Restore
          </SectionAction>
        }
        title="Canvas"
      >
        {settings && (
          <>
            <div className="grid grid-cols-2 gap-4">
              {/* Size */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Size</FieldLabel>
                <p className="text-2xs text-[var(--muted-foreground)]">
                  original: {originalSize ? `${originalSize.width}×${originalSize.height}` : "—"}
                </p>
                <div className="flex items-center gap-1.5">
                  <TextInput
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={widthStr}
                    onChange={(e) => {
                      setWidthStr(e.target.value)
                      commitSize("width", e.target.value)
                    }}
                    onBlur={() => setWidthStr(String(Math.round(settings.width)))}
                  />
                  <span className="text-2xs text-[var(--muted-foreground)]">x</span>
                  <TextInput
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={heightStr}
                    onChange={(e) => {
                      setHeightStr(e.target.value)
                      commitSize("height", e.target.value)
                    }}
                    onBlur={() => setHeightStr(String(Math.round(settings.height)))}
                  />
                </div>
              </div>

              {/* Position */}
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Position</FieldLabel>
                <div
                  ref={padRef}
                  onPointerDown={(e) => {
                    dragging.current = true
                    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
                    handlePad(e)
                  }}
                  onPointerMove={(e) => dragging.current && handlePad(e)}
                  onPointerUp={() => (dragging.current = false)}
                  className="relative h-24 cursor-crosshair rounded-md bg-[var(--secondary)]"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--border)]" />
                  <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--border)]" />
                  <div
                    className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-[var(--foreground)] bg-[color-mix(in_oklab,var(--foreground)_20%,transparent)]"
                    style={{ left: `${handleX}%`, top: `${handleY}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Zoom — manual entry only. Same 2-column grid as Size/Position above,
                so the field lines up with the position pad rather than floating. */}
            <div className="grid grid-cols-2 items-center gap-4">
              <FieldLabel>Zoom</FieldLabel>
              <div>
                <TextInput
                  type="number"
                  min={0.2}
                  max={4}
                  step={0.1}
                  inputMode="decimal"
                  value={zoomStr}
                  onChange={(e) => {
                    setZoomStr(e.target.value)
                    commitZoom(e.target.value)
                  }}
                  onBlur={() => setZoomStr(settings.zoom.toFixed(2))}
                />
              </div>
            </div>

            {/* Canvas background */}
            <div className="flex flex-col gap-2">
              <FieldLabel>Canvas background</FieldLabel>
              <SegmentedControl
                aria-label="Canvas background"
                onChange={(bgMode) => onChange({ bgMode })}
                options={BG_MODES}
                value={settings.bgMode}
              />

              {settings.bgMode === 1 && (
                <label className="flex items-center justify-between rounded-md bg-[var(--secondary)] px-3 py-2">
                  <span className="text-xs text-[var(--foreground)]">Color</span>
                  <input
                    type="color"
                    value={toHex(settings.bgColor)}
                    onChange={(e) => onChange({ bgColor: fromHex(e.target.value) })}
                    className="size-7 cursor-pointer rounded bg-transparent"
                  />
                </label>
              )}

              {settings.bgMode === 2 && (
                <button
                  type="button"
                  onClick={onPickBgImage}
                  className="flex w-full items-center gap-3 rounded-md bg-[var(--secondary)] px-3 py-2 text-left transition hover:brightness-110"
                >
                  <div className="size-9 shrink-0 overflow-hidden rounded bg-[var(--muted)]">
                    {bgPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={bgPreviewUrl || "/placeholder.svg"} alt="Background" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-[var(--muted-foreground)]">
                        <ImageIcon className="size-4" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-[var(--muted-foreground)]">{bgPreviewUrl ? "Change image" : "Choose image"}</span>
                </button>
              )}
            </div>
          </>
        )}
      </CollapsibleSection>
    </>
  )
}
