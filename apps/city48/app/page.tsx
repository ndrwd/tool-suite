"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Download, ImageIcon } from "lucide-react"
import { Button } from "@tools/ui"
import { ShaderCanvas, type ShaderCanvasHandle } from "@/components/shader-canvas"
import { ControlsPanel } from "@/components/controls-panel"
import { MediaPanel } from "@/components/media-panel"
import { getShader, defaultParams, createLayer, type ShaderLayer } from "@/lib/shaders"
import { DEFAULT_CANVAS, type CanvasSettings, type MediaSource } from "@/lib/renderer"

export default function Page() {
  const [layers, setLayers] = useState<ShaderLayer[]>(() => [createLayer("dither")])
  const [selectedUid, setSelectedUid] = useState<string | null>(() => null)
  const [media, setMedia] = useState<MediaSource | null>(null)
  const [mediaName, setMediaName] = useState<string>("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [originalSize, setOriginalSize] = useState<{ width: number; height: number } | null>(null)
  const [settings, setSettings] = useState<CanvasSettings | null>(null)
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null)
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)
  const canvasHandle = useRef<ShaderCanvasHandle>(null)

  // Keep a valid layer selected as the stack changes.
  useEffect(() => {
    if (layers.length === 0) {
      if (selectedUid !== null) setSelectedUid(null)
    } else if (!layers.some((l) => l.uid === selectedUid)) {
      setSelectedUid(layers[layers.length - 1].uid)
    }
  }, [layers, selectedUid])

  const handleAddLayer = useCallback(() => {
    const layer = createLayer("dither")
    setLayers((prev) => [...prev, layer])
    setSelectedUid(layer.uid)
  }, [])

  const handleRemoveLayer = useCallback((uid: string) => {
    setLayers((prev) => prev.filter((l) => l.uid !== uid))
  }, [])

  const handleToggleLayer = useCallback((uid: string) => {
    setLayers((prev) => prev.map((l) => (l.uid === uid ? { ...l, enabled: !l.enabled } : l)))
  }, [])

  const handleChangeShader = useCallback((uid: string, shaderId: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, shaderId, params: defaultParams(getShader(shaderId)) } : l)),
    )
  }, [])

  const handleParamChange = useCallback((uid: string, key: string, value: number) => {
    setLayers((prev) => prev.map((l) => (l.uid === uid ? { ...l, params: { ...l.params, [key]: value } } : l)))
  }, [])

  const handleResetParams = useCallback((uid: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, params: defaultParams(getShader(l.shaderId)) } : l)),
    )
  }, [])

  const loadFile = useCallback((file: File) => {
    setError(null)

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        setMediaName(file.name)
        setPreviewUrl(url)
        setOriginalSize({ width: img.naturalWidth, height: img.naturalHeight })
        setSettings({ width: img.naturalWidth, height: img.naturalHeight, ...DEFAULT_CANVAS })
        setMedia({ kind: "image", el: img, width: img.naturalWidth, height: img.naturalHeight })
      }
      img.onerror = () => setError("Failed to load image")
      img.src = url
    } else if (file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file)
      const video = document.createElement("video")
      video.crossOrigin = "anonymous"
      video.loop = true
      video.muted = true
      video.playsInline = true
      video.src = url
      video.onloadeddata = () => {
        video.play().catch(() => {})
        setMediaName(file.name)
        setPreviewUrl(url)
        setOriginalSize({ width: video.videoWidth, height: video.videoHeight })
        setSettings({ width: video.videoWidth, height: video.videoHeight, ...DEFAULT_CANVAS })
        setMedia({ kind: "video", el: video, width: video.videoWidth, height: video.videoHeight })
      }
      video.onerror = () => setError("Failed to load video")
    } else {
      setError("Unsupported file type. Upload an image or video.")
    }
  }, [])

  const loadBgImage = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      setBgImage(img)
      setBgPreviewUrl(url)
    }
    img.src = url
  }, [])

  // Load the default city image on mount so shaders have a preview immediately.
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      setMediaName("city48.jpg")
      setPreviewUrl(img.src)
      setOriginalSize({ width: img.naturalWidth, height: img.naturalHeight })
      setSettings({ width: img.naturalWidth, height: img.naturalHeight, ...DEFAULT_CANVAS })
      setMedia({ kind: "image", el: img, width: img.naturalWidth, height: img.naturalHeight })
    }
    img.src = "/default-city.jpg"
  }, [])

  // Paste an image from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"))
      const file = item?.getAsFile()
      if (file) loadFile(file)
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [loadFile])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
  }

  const handleBgInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadBgImage(file)
  }

  const pickMedia = (type: "image" | "video") => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === "video" ? "video/*" : "image/*"
      fileInputRef.current.click()
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) loadFile(file)
  }

  const handleCanvasChange = useCallback((patch: Partial<CanvasSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const handleCanvasReset = useCallback(() => {
    if (originalSize) setSettings({ width: originalSize.width, height: originalSize.height, ...DEFAULT_CANVAS })
  }, [originalSize])

  const handleDownload = () => {
    const dataUrl = canvasHandle.current?.capture()
    if (!dataUrl) return
    const a = document.createElement("a")
    a.href = dataUrl
    a.download = `city48-${Date.now()}.png`
    a.click()
  }

  const clearMedia = () => {
    setMedia(null)
    setMediaName("")
    setPreviewUrl(null)
    setOriginalSize(null)
    setSettings(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <main className="flex h-screen flex-col bg-background text-foreground">
      {/* Hidden file inputs — the top header was removed; export lives in the panel. */}
      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileInput} />
      <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgInput} />

      <div className="flex min-h-0 flex-1">
        {/* Canvas / drop zone */}
        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden p-6"
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 ${media ? "hidden" : "opacity-40"}`}
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <ShaderCanvas
            ref={canvasHandle}
            media={media}
            layers={layers}
            settings={settings}
            bgImage={bgImage}
            onError={setError}
            className="relative z-10"
          />

          {!media && (
            <button
              type="button"
              onClick={() => pickMedia("image")}
              className={`relative z-10 flex flex-col items-center gap-4 rounded-xl border border-dashed px-16 py-14 text-center transition-colors ${
                dragging ? "border-foreground bg-secondary/60" : "border-border hover:border-foreground/40"
              }`}
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
                <ImageIcon className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Drop an image or video</p>
                <p className="mt-1 text-xs text-muted-foreground">click to browse, or paste with Cmd/Ctrl+V</p>
              </div>
            </button>
          )}

          {error && (
            <div className="absolute bottom-4 left-1/2 z-20 max-w-md -translate-x-1/2 rounded-md border border-destructive/50 bg-card px-4 py-2 text-center text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Sidebar — matches the shape-morph panel: w-72, solid card bg, title header.
            A scrollable middle sits under a pinned title header and a pinned export footer. */}
        <aside className="flex h-full w-72 shrink-0 flex-col border-l border-[var(--border)] bg-[var(--card)]">
          <header className="shrink-0 border-b border-[var(--border)] px-4 py-3">
            <h1 className="text-sm font-semibold text-[var(--foreground)]">City48</h1>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MediaPanel
              mediaKind={media?.kind ?? null}
              previewUrl={previewUrl}
              originalSize={originalSize}
              settings={settings}
              onChange={handleCanvasChange}
              onReset={handleCanvasReset}
              onPickMedia={pickMedia}
              bgPreviewUrl={bgPreviewUrl}
              onPickBgImage={() => bgInputRef.current?.click()}
            />
            <ControlsPanel
              layers={layers}
              selectedUid={selectedUid}
              onSelectLayer={setSelectedUid}
              onAddLayer={handleAddLayer}
              onRemoveLayer={handleRemoveLayer}
              onToggleLayer={handleToggleLayer}
              onChangeShader={handleChangeShader}
              onParamChange={handleParamChange}
              onResetParams={handleResetParams}
            />
          </div>
          <div className="shrink-0 border-t border-[var(--border)] p-4">
            <Button onClick={handleDownload} disabled={!media}>
              <Download className="size-3.5" />
              Export PNG
            </Button>
          </div>
        </aside>
      </div>
    </main>
  )
}
