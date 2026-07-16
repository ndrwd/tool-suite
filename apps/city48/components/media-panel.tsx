"use client"

import { useEffect, useRef, useState } from "react"
import { ImageIcon, Video, RotateCcw } from "lucide-react"
import { Chevron, TextInput } from "@tools/ui"
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

// Shared caption style — matches the design system (@tools/ui FieldLabel).
const caption = "text-2xs font-medium text-[var(--muted-foreground)]"

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

const BG_MODES: { id: 0 | 1 | 2; label: string }[] = [
  { id: 0, label: "None" },
  { id: 1, label: "Color" },
  { id: 2, label: "Image" },
]

// Monochrome segmented control shared by the media tabs and background modes.
function segClass(active: boolean) {
  return `flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-2xs font-semibold transition-colors ${
    active
      ? "bg-[var(--secondary)] text-[var(--foreground)]"
      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
  }`
}

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
  const [collapsed, setCollapsed] = useState(true)
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
        <div className="flex flex-1 rounded-md bg-[var(--muted)] p-0.5">
          <button type="button" onClick={() => onPickMedia("image")} className={segClass(activeTab === "image")}>
            <ImageIcon className="size-3.5" />
            Image
          </button>
          <button type="button" onClick={() => onPickMedia("video")} className={segClass(activeTab === "video")}>
            <Video className="size-3.5" />
            Video
          </button>
        </div>

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
      <section className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1.5"
        >
          <Chevron collapsed={collapsed} />
          <span className="text-2xs font-semibold tracking-wide text-[var(--foreground)]">Canvas</span>
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 text-2xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
        >
          <RotateCcw className="size-3" />
          Restore
        </button>
      </div>

      {!collapsed && settings && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Size */}
            <div className="flex flex-col gap-1.5">
              <span className={caption}>Size</span>
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
              <span className={caption}>Position</span>
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

          {/* Zoom — manual entry only */}
          <div className="flex items-center justify-between gap-3">
            <span className={caption}>Zoom</span>
            <div className="w-24">
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
            <span className={caption}>Canvas background</span>
            <div className="flex rounded-md bg-[var(--muted)] p-0.5">
              {BG_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onChange({ bgMode: mode.id })}
                  className={segClass(settings.bgMode === mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>

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
        </div>
      )}
      </section>
    </>
  )
}
