import type { AppState } from "./types";

/**
 * Export sizing and background helpers. Self-contained so preview and export
 * stay pixel-identical.
 */

export type RetinaExportSize = { height: number; pixelRatio: number; width: number };

const imageLongEdges: Record<string, number> = {
  "2k": 2048,
  "4k": 4096,
  "8k": 8192,
};

const videoMaxSizes: Record<string, { height: number; width: number }> = {
  "4k": { height: 2160, width: 3840 },
};

function roundVideoDimension(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

function retinaSize(state: AppState): RetinaExportSize {
  const globalPixelRatio = (globalThis as typeof globalThis & { devicePixelRatio?: number }).devicePixelRatio;
  const pixelRatio = Math.max(2, typeof globalPixelRatio === "number" && Number.isFinite(globalPixelRatio) ? globalPixelRatio : 1);

  return {
    height: Math.ceil(state.canvas.size.height * pixelRatio),
    pixelRatio,
    width: Math.ceil(state.canvas.size.width * pixelRatio),
  };
}

export function getImageExportSize(resolution: string, state: AppState): RetinaExportSize {
  const targetLongEdge = imageLongEdges[String(resolution).toLowerCase()];

  if (!targetLongEdge) {
    return retinaSize(state);
  }

  const cssWidth = Math.max(1, state.canvas.size.width);
  const cssHeight = Math.max(1, state.canvas.size.height);
  const dominantSize = Math.max(cssWidth, cssHeight);
  const pixelRatio = targetLongEdge / dominantSize;

  if (cssWidth >= cssHeight) {
    return { height: Math.max(1, Math.round(cssHeight * pixelRatio)), pixelRatio, width: targetLongEdge };
  }

  return { height: targetLongEdge, pixelRatio, width: Math.max(1, Math.round(cssWidth * pixelRatio)) };
}

export function getVideoExportSize(resolution: string, state: AppState): RetinaExportSize {
  const cssWidth = Math.max(1, state.canvas.size.width);
  const cssHeight = Math.max(1, state.canvas.size.height);
  const targetMaxSize = videoMaxSizes[String(resolution).toLowerCase()];

  if (!targetMaxSize) {
    const width = roundVideoDimension(cssWidth);
    const height = roundVideoDimension(cssHeight);
    return { height, pixelRatio: Math.max(width / cssWidth, height / cssHeight), width };
  }

  const pixelRatio = Math.min(targetMaxSize.width / cssWidth, targetMaxSize.height / cssHeight);
  const width = roundVideoDimension(cssWidth * pixelRatio);
  const height = roundVideoDimension(cssHeight * pixelRatio);

  return { height, pixelRatio: Math.max(width / cssWidth, height / cssHeight), width };
}

/** Whether the live preview paints the background — driven by the Include switch. */
export function shouldIncludePreviewBackground(state: AppState): boolean {
  const value = state.values["export.includeBackground"];
  return typeof value === "boolean" ? value : true;
}

export type PngRenderContext = {
  context: CanvasRenderingContext2D;
  cssHeight: number;
  cssWidth: number;
};

/** Build an offscreen still-export canvas at the target resolution. */
export function createPngExportCanvas(options: {
  background: string;
  includeBackground: boolean;
  render: (ctx: PngRenderContext) => void;
  resolution: string;
  state: AppState;
}): HTMLCanvasElement {
  const { background, includeBackground, render, resolution, state } = options;
  const canvas = document.createElement("canvas");
  const { height, pixelRatio, width } = getImageExportSize(resolution, state);

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("PNG export requires a 2D canvas context.");
  }

  context.save();
  context.clearRect(0, 0, width, height);

  if (includeBackground) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }

  context.scale(pixelRatio, pixelRatio);
  render({ context, cssHeight: state.canvas.size.height, cssWidth: state.canvas.size.width });
  context.restore();

  return canvas;
}
