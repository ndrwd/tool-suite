"use client"

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react"
import { ShaderRenderer, type MediaSource, type CanvasSettings } from "@/lib/renderer"
import { getShader, type ShaderLayer } from "@/lib/shaders"

export type ShaderCanvasHandle = {
  capture: () => string | null
}

type Props = {
  media: MediaSource | null
  layers: ShaderLayer[]
  settings: CanvasSettings | null
  bgImage: HTMLImageElement | null
  onError: (message: string | null) => void
  className?: string
}

export const ShaderCanvas = forwardRef<ShaderCanvasHandle, Props>(function ShaderCanvas(
  { media, layers, settings, bgImage, onError, className },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<ShaderRenderer | null>(null)

  useImperativeHandle(ref, () => ({
    capture: () => rendererRef.current?.capture() ?? null,
  }))

  // Initialize renderer once.
  useEffect(() => {
    if (!canvasRef.current) return
    try {
      const renderer = new ShaderRenderer(canvasRef.current)
      rendererRef.current = renderer
      renderer.start()
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to initialize WebGL")
    }
    return () => {
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [onError])

  // Update media.
  useEffect(() => {
    if (!rendererRef.current || !media) return
    rendererRef.current.setMedia(media)
  }, [media])

  // Update canvas settings (size / position / zoom / background).
  useEffect(() => {
    if (!rendererRef.current || !settings) return
    rendererRef.current.setSettings(settings)
  }, [settings])

  // Update background image.
  useEffect(() => {
    rendererRef.current?.setBackgroundImage(bgImage)
  }, [bgImage])

  // Update the shader chain (enabled layers, in order).
  useEffect(() => {
    if (!rendererRef.current) return
    try {
      const enabled = layers
        .filter((l) => l.enabled)
        .map((l) => ({ shader: getShader(l.shaderId), params: l.params }))
      rendererRef.current.setLayers(enabled)
      onError(null)
    } catch (e) {
      onError(e instanceof Error ? e.message : "Shader error")
    }
  }, [layers, onError])

  return (
    <canvas
      ref={canvasRef}
      className={`max-h-full max-w-full rounded-lg object-contain ${className ?? ""}`}
      style={{ display: media ? "block" : "none" }}
    />
  )
})
