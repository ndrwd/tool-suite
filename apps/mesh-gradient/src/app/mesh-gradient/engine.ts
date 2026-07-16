import type { MeshGradientSettings, MeshNode } from "./settings";

/**
 * A node resolved to canvas coordinate space (CSS pixels of
 * `state.canvas.size`) with its orbit baked in, so the renderer and both export
 * paths share identical geometry at any backing resolution.
 */
export type MeshBlob = {
  baseX: number;
  baseY: number;
  color: string;
  /** Whole cycles per timeline loop — integers keep the orbit seamless. */
  cycles: number;
  orbitX: number;
  orbitY: number;
  /** 0..1 offset into the orbit so nodes do not move in lockstep. */
  phase: number;
  radius: number;
};

export type DrawMeshOptions = {
  blobs: MeshBlob[];
  blur: number;
  grain: number;
  height: number;
  loopProgress: number;
  motionAmplitude: number;
  width: number;
};

/** Deterministic PRNG — same seed always yields the same value. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a — turns a node id into a stable seed for its orbit. */
function hashId(id: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/**
 * Resolve authored nodes into drawable blobs. Orbit params derive from the
 * node's id rather than its array position, so dragging, adding, or deleting a
 * node never re-rolls the motion of the others.
 */
export function buildMesh(
  settings: MeshGradientSettings,
  width: number,
  height: number,
): MeshBlob[] {
  const shorterSide = Math.min(width, height);

  return settings.nodes.map((node: MeshNode): MeshBlob => {
    const random = mulberry32(hashId(node.id));

    return {
      baseX: node.x * width,
      baseY: node.y * height,
      color: node.color,
      cycles: 1 + Math.floor(random() * 2),
      orbitX: 0.6 + random() * 0.8,
      orbitY: 0.6 + random() * 0.8,
      phase: random(),
      radius: settings.spread * node.scale * shorterSide,
    };
  });
}

let grainTile: HTMLCanvasElement | null = null;

/**
 * Monochrome noise tile, built once and reused as a repeating pattern.
 *
 * 2048 is deliberate: the grain is static, so the tile is generated once and
 * cached, and the only real cost is the one-off ~17MB. It covers a 1080p/1440p
 * canvas outright — no repeat, no visible grid. A small tile (128) is cheaper
 * still but lays a plainly visible lattice across the frame once Grain is
 * turned up, which is exactly what it must not do.
 */
const GRAIN_TILE_SIZE = 2048;

function getGrainTile(): HTMLCanvasElement | null {
  if (grainTile) {
    return grainTile;
  }

  if (typeof document === "undefined") {
    return null;
  }

  const size = GRAIN_TILE_SIZE;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;

  const context = tile.getContext("2d");

  if (!context) {
    return null;
  }

  const image = context.createImageData(size, size);
  const random = mulberry32(0x9e3779b9);

  for (let index = 0; index < image.data.length; index += 4) {
    const value = Math.round(random() * 255);
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = 255;
  }

  context.putImageData(image, 0, 0);
  grainTile = tile;

  return tile;
}

/** Live position of a blob at a point in the loop — shared by the renderer and
 * the on-canvas drag handles so a handle always sits on its blob. */
export function blobPosition(
  blob: MeshBlob,
  loopProgress: number,
  motionAmplitude: number,
): { x: number; y: number } {
  const angle = 2 * Math.PI * (blob.cycles * loopProgress + blob.phase);

  return {
    x: blob.baseX + Math.cos(angle) * blob.orbitX * motionAmplitude,
    y: blob.baseY + Math.sin(angle) * blob.orbitY * motionAmplitude,
  };
}

/**
 * Paint the mesh. Each node is a radial gradient fading to full transparency;
 * a single canvas `blur` filter melts them into one continuous field, which is
 * what separates a mesh gradient from a pile of visible circles.
 *
 * The caller owns the background fill — the blobs are drawn over whatever is
 * already on the context.
 */
export function drawMeshGradient(
  context: CanvasRenderingContext2D,
  options: DrawMeshOptions,
): void {
  const { blobs, blur, grain, height, loopProgress, motionAmplitude, width } = options;

  context.save();
  context.filter = blur > 0 ? `blur(${blur}px)` : "none";
  // 'lighter' would blow out toward white where nodes overlap; source-over
  // keeps each color readable and lets the blur do the blending.
  context.globalCompositeOperation = "source-over";

  for (const blob of blobs) {
    const { x, y } = blobPosition(blob, loopProgress, motionAmplitude);

    const gradient = context.createRadialGradient(x, y, 0, x, y, blob.radius);
    gradient.addColorStop(0, withAlpha(blob.color, 1));
    gradient.addColorStop(0.5, withAlpha(blob.color, 0.55));
    gradient.addColorStop(1, withAlpha(blob.color, 0));

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, blob.radius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();

  if (grain > 0) {
    const tile = getGrainTile();

    if (tile) {
      const pattern = context.createPattern(tile, "repeat");

      if (pattern) {
        context.save();
        context.globalCompositeOperation = "overlay";
        context.globalAlpha = grain;
        context.fillStyle = pattern;
        context.fillRect(0, 0, width, height);
        context.restore();
      }
    }
  }
}

/**
 * Apply an alpha to a hex color. Handles the 8-digit form the runtime's color
 * control emits when opacity is set, multiplying the two alphas together.
 */
function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const hasAlpha = normalized.length === 8;
  const base = normalized.slice(0, 6);
  const existing = hasAlpha ? parseInt(normalized.slice(6, 8), 16) / 255 : 1;

  const r = parseInt(base.slice(0, 2), 16) || 0;
  const g = parseInt(base.slice(2, 4), 16) || 0;
  const b = parseInt(base.slice(4, 6), 16) || 0;

  return `rgba(${r}, ${g}, ${b}, ${alpha * existing})`;
}
