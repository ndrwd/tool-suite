/**
 * Minimal, self-contained state model for Shape Morph. `values` is a flat map
 * keyed by each control's `target` string — the renderer and export paths read
 * straight from it.
 */

export type FontValue = {
  color?: string;
  fontId: string;
  fontSize?: number;
  fontWeight?: string;
  letterSpacing?: "tight" | "tighter" | "normal" | "wide" | "wider" | "widest";
  opacity?: number;
  textCase?: "capitalize" | "lowercase" | "original" | "titleCase" | "uppercase";
};

export type CanvasState = {
  size: { height: number; width: number };
  renderScale: number;
  aspect: string;
};

export type TimelineState = {
  currentTimeSeconds: number;
  durationSeconds: number;
  playing: boolean;
};

export type Theme = "dark" | "light";

export type AppState = {
  values: Record<string, unknown>;
  canvas: CanvasState;
  timeline: TimelineState;
  theme: Theme;
};
