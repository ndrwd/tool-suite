import { getFontById, type FontCatalogEntry } from "@tools/runtime";

import type { FontValue } from "@tools/runtime";

/**
 * Normalized, renderer-ready settings derived from raw runtime `state.values`.
 * The renderer and both export paths consume this single shape so preview and
 * export stay pixel-identical.
 */
export type ShapeMorphSettings = {
  accentAmount: number; // 0..1 fraction of particles tinted with accentColor
  accentColor: string;
  background: string;
  baseColor: string;
  density: number; // particle count
  dotSize: number; // px, at canvas coordinate scale
  fontEntry: FontCatalogEntry | null;
  fontFamily: string;
  fontSizePx: number;
  fontWeight: number;
  jitter: number; // 0..1 positional randomness
  roundness: number; // 0 = square, 1 = full circle
  letterSpacingEm: number;
  motionAmplitude: number; // px drift around target
  motionCycles: number; // whole sine cycles per timeline loop (seamless)
  text: string;
};

export const SHAPE_MORPH_TARGETS = {
  accentAmount: "accent.amount",
  accentColor: "accent.color",
  background: "scene.background",
  density: "field.density",
  dotSize: "field.dotSize",
  font: "text.font",
  includeBackground: "export.includeBackground",
  jitter: "field.jitter",
  roundness: "field.roundness",
  motionAmplitude: "motion.amplitude",
  motionSpeed: "motion.speed",
  text: "text.content",
} as const;

const LETTER_SPACING_EM: Record<string, number> = {
  tighter: -0.06,
  tight: -0.03,
  normal: 0,
  wide: 0.04,
  wider: 0.08,
  widest: 0.14,
};

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/**
 * Runtime `color`/`colorOpacity` controls store `{ hex, opacity? }` objects
 * (persisted state confirms this); plain strings appear for defaults. Accept
 * both and flatten opacity into an 8-digit hex when present.
 */
function toHexColor(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (typeof value === "object" && value !== null && "hex" in value) {
    const { hex, opacity } = value as { hex?: unknown; opacity?: unknown };

    if (typeof hex === "string" && hex.length > 0) {
      return typeof opacity === "number" ? normalizeHexAlpha(hex, opacity) : hex;
    }
  }

  return fallback;
}

function applyTextCase(text: string, textCase: string | undefined): string {
  switch (textCase) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    case "capitalize":
    case "titleCase":
      return text.replace(/\b\p{L}/gu, (character) => character.toUpperCase());
    default:
      return text;
  }
}

function normalizeHexAlpha(hex: string, opacity: number | undefined): string {
  const clampedOpacity = Math.max(0, Math.min(100, toNumber(opacity, 100))) / 100;

  if (clampedOpacity >= 1) {
    return hex;
  }

  const alpha = Math.round(clampedOpacity * 255)
    .toString(16)
    .padStart(2, "0");

  return `${hex}${alpha}`;
}

/**
 * Reads every product control into a renderer-ready shape. Base particle color
 * and typography come from the atomic `fontPicker`; accent color/amount and the
 * shape-field/motion sliders are the app's own field effects.
 */
export function readShapeMorphSettings(
  values: Record<string, unknown>,
): ShapeMorphSettings {
  const font = (values[SHAPE_MORPH_TARGETS.font] ?? {}) as FontValue;
  const fontEntry = getFontById(font.fontId);

  const rawText = toString(values[SHAPE_MORPH_TARGETS.text], "❤️");
  const text = applyTextCase(rawText, font.textCase);

  const motionSpeed = toNumber(values[SHAPE_MORPH_TARGETS.motionSpeed], 30);

  return {
    accentAmount: Math.max(0, Math.min(100, toNumber(values[SHAPE_MORPH_TARGETS.accentAmount], 30))) / 100,
    accentColor: toHexColor(values[SHAPE_MORPH_TARGETS.accentColor], "#DB0000"),
    background: toHexColor(values[SHAPE_MORPH_TARGETS.background], "#0F0A1A"),
    baseColor: normalizeHexAlpha(toString(font.color, "#FFFFFF"), font.opacity),
    density: Math.round(toNumber(values[SHAPE_MORPH_TARGETS.density], 900)),
    dotSize: toNumber(values[SHAPE_MORPH_TARGETS.dotSize], 4),
    fontEntry,
    fontFamily: fontEntry?.family ?? "Inter",
    fontSizePx: toNumber(font.fontSize, 600),
    fontWeight: Math.round(toNumber(Number(font.fontWeight), 900)),
    jitter: Math.max(0, Math.min(1, toNumber(values[SHAPE_MORPH_TARGETS.jitter], 0.4))),
    roundness:
      Math.max(0, Math.min(100, toNumber(values[SHAPE_MORPH_TARGETS.roundness], 100))) / 100,
    letterSpacingEm: LETTER_SPACING_EM[font.letterSpacing ?? "normal"] ?? 0,
    motionAmplitude: toNumber(values[SHAPE_MORPH_TARGETS.motionAmplitude], 15),
    // Map 0..100 speed to 1..8 whole cycles so the sine drift closes seamlessly
    // at the loop boundary (first and last frame stitch).
    motionCycles: Math.max(1, Math.round(1 + (motionSpeed / 100) * 7)),
    text,
  };
}

/** Background color for export paths — same object/string handling as preview. */
export function readShapeMorphBackground(values: Record<string, unknown>): string {
  return toHexColor(values[SHAPE_MORPH_TARGETS.background], "#0F0A1A");
}

/** Stable signature of everything that changes the target particle cloud. */
export function shapeSignature(settings: ShapeMorphSettings, width: number, height: number): string {
  return [
    settings.text,
    settings.fontFamily,
    settings.fontWeight,
    settings.fontSizePx,
    settings.letterSpacingEm,
    settings.density,
    settings.jitter,
    Math.round(width),
    Math.round(height),
  ].join("|");
}
