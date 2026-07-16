/**
 * One color node of the mesh, as authored by the user. Positions are stored
 * NORMALIZED (0..1 of the canvas) so a node keeps its place when the canvas
 * aspect or export resolution changes.
 */
export type MeshNode = {
  color: string;
  id: string;
  /** Per-node size multiplier applied on top of the global Spread. */
  scale: number;
  x: number;
  y: number;
};

/**
 * Normalized, renderer-ready settings derived from raw runtime `state.values`.
 * The renderer and both export paths consume this single shape so preview and
 * export stay pixel-identical.
 */
export type MeshGradientSettings = {
  background: string;
  blur: number; // px, at canvas coordinate scale
  grain: number; // 0..1 overlay opacity
  motionAmplitude: number; // px drift around the base position
  nodes: MeshNode[];
  /** Global node radius as a fraction of the canvas's shorter side. */
  spread: number;
};

export const MESH_TARGETS = {
  background: "scene.background",
  blur: "mesh.blur",
  grain: "texture.grain",
  includeBackground: "export.includeBackground",
  motionAmplitude: "motion.amplitude",
  nodes: "mesh.nodes",
  spread: "mesh.spread",
} as const;

/** Opening layout — four corners-ish nodes that read as a classic mesh. */
export const DEFAULT_NODES: MeshNode[] = [
  { color: "#5B2BE1", id: "n1", scale: 1, x: 0.22, y: 0.26 },
  { color: "#E12B8A", id: "n2", scale: 1, x: 0.76, y: 0.3 },
  { color: "#2BB8E1", id: "n3", scale: 1, x: 0.3, y: 0.74 },
  { color: "#E1C22B", id: "n4", scale: 1, x: 0.8, y: 0.78 },
];

export const NODE_PALETTE = [
  "#5B2BE1",
  "#E12B8A",
  "#2BB8E1",
  "#E1C22B",
  "#2BE196",
  "#E1782B",
];

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Runtime `color` controls store `{ hex, opacity? }` objects; plain strings
 * appear for defaults. Accept both and flatten opacity into an 8-digit hex.
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

function normalizeHexAlpha(hex: string, opacity: number | undefined): string {
  const clampedOpacity = clamp(toNumber(opacity, 100), 0, 100) / 100;

  if (clampedOpacity >= 1) {
    return hex;
  }

  const alpha = Math.round(clampedOpacity * 255)
    .toString(16)
    .padStart(2, "0");

  return `${hex}${alpha}`;
}

/**
 * Nodes are user data (an array under one key), not a schema control, so they
 * are validated defensively here — persisted state from an older build, or a
 * hand-edited localStorage entry, must never crash the renderer.
 */
export function readMeshNodes(value: unknown): MeshNode[] {
  if (!Array.isArray(value)) {
    return DEFAULT_NODES;
  }

  const nodes = value.flatMap((entry, index): MeshNode[] => {
    if (typeof entry !== "object" || entry === null) {
      return [];
    }

    const node = entry as Partial<MeshNode>;

    return [
      {
        color: toHexColor(node.color, NODE_PALETTE[index % NODE_PALETTE.length]),
        id: typeof node.id === "string" && node.id.length > 0 ? node.id : `n${index}`,
        scale: clamp(toNumber(node.scale, 1), 0.2, 3),
        x: clamp(toNumber(node.x, 0.5), -0.5, 1.5),
        y: clamp(toNumber(node.y, 0.5), -0.5, 1.5),
      },
    ];
  });

  return nodes.length > 0 ? nodes : DEFAULT_NODES;
}

/** Reads every product control into a renderer-ready shape. */
export function readMeshGradientSettings(
  values: Record<string, unknown>,
): MeshGradientSettings {
  return {
    background: toHexColor(values[MESH_TARGETS.background], "#0A0A0F"),
    blur: clamp(toNumber(values[MESH_TARGETS.blur], 80), 0, 300),
    grain: clamp(toNumber(values[MESH_TARGETS.grain], 8), 0, 100) / 100,
    motionAmplitude: clamp(toNumber(values[MESH_TARGETS.motionAmplitude], 90), 0, 400),
    nodes: readMeshNodes(values[MESH_TARGETS.nodes]),
    spread: clamp(toNumber(values[MESH_TARGETS.spread], 55), 10, 150) / 100,
  };
}

/** Background color for export paths — same object/string handling as preview. */
export function readMeshGradientBackground(values: Record<string, unknown>): string {
  return toHexColor(values[MESH_TARGETS.background], "#0A0A0F");
}
