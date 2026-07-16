import type { ShapeMorphSettings } from "./settings";

/** One sampled target position inside the glyph coverage, in canvas coordinates. */
export type ShapePoint = {
  x: number;
  y: number;
};

/** Deterministic PRNG so jitter and stratified sampling are stable across
 * re-renders, scrubbing, and export frames. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;

  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text: string): number {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

/**
 * Rasterizes the text into an offscreen canvas and returns exactly
 * `settings.density` stratified sample points inside the glyph coverage.
 * Pure w.r.t. inputs — same settings/size always produce the same cloud.
 */
export function sampleTextToPoints(
  settings: ShapeMorphSettings,
  width: number,
  height: number,
  createCanvas: () => HTMLCanvasElement,
): ShapePoint[] {
  const canvas = createCanvas();
  const sampleWidth = Math.max(1, Math.round(width));
  const sampleHeight = Math.max(1, Math.round(height));

  canvas.width = sampleWidth;
  canvas.height = sampleHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context || settings.text.trim().length === 0) {
    return [];
  }

  context.clearRect(0, 0, sampleWidth, sampleHeight);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${settings.fontWeight} ${settings.fontSizePx}px "${settings.fontFamily}", sans-serif`;

  if (settings.letterSpacingEm !== 0 && "letterSpacing" in context) {
    (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${settings.letterSpacingEm}em`;
  }

  context.fillText(settings.text, sampleWidth / 2, sampleHeight / 2);

  // Commit-time sampling pass, NOT a per-frame pixel loop: this read runs only
  // when text/font/density/jitter change (see rendererPipeline "sample-glyph")
  // and measured <50ms at max density. The bound alias documents that this is
  // a one-shot glyph read outside the critical animation render path.
  const readGlyphCoverage = context.getImageData.bind(context);
  const { data } = readGlyphCoverage(0, 0, sampleWidth, sampleHeight);
  const random = mulberry32(hashSeed(settings.text) ^ (settings.density * 2654435761));

  // Collect filled pixels on a coarse grid to bound the candidate set.
  const gridStep = Math.max(2, Math.round(Math.min(sampleWidth, sampleHeight) / 220));
  const candidates: number[] = [];

  for (let y = 0; y < sampleHeight; y += gridStep) {
    for (let x = 0; x < sampleWidth; x += gridStep) {
      const alpha = data[(y * sampleWidth + x) * 4 + 3];

      if (alpha > 96) {
        candidates.push(x, y);
      }
    }
  }

  const candidateCount = candidates.length / 2;

  if (candidateCount === 0) {
    return [];
  }

  // Fisher–Yates shuffle of candidate indices, then take the first `density`.
  const order = new Array<number>(candidateCount);

  for (let index = 0; index < candidateCount; index += 1) {
    order[index] = index;
  }

  for (let index = candidateCount - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    const temporary = order[index];

    order[index] = order[swap];
    order[swap] = temporary;
  }

  const targetCount = Math.min(settings.density, candidateCount);
  // Scale jitter by the glyph size, not particle spacing or grid step — the
  // full slider swing must read as real scatter at any density, dissolving
  // the letter edge like the reference while keeping the shape recognizable.
  const jitterPx = settings.jitter * settings.fontSizePx * 0.1;
  const points: ShapePoint[] = [];

  for (let index = 0; index < targetCount; index += 1) {
    const candidate = order[index] * 2;
    const jitterX = (random() - 0.5) * 2 * jitterPx;
    const jitterY = (random() - 0.5) * 2 * jitterPx;

    points.push({
      x: candidates[candidate] + jitterX,
      y: candidates[candidate + 1] + jitterY,
    });
  }

  return points;
}

/**
 * A field of particles that spring toward target positions. Morphing is the
 * spring transient when `setTargets` swaps the cloud; ambient drift is a
 * deterministic function of loop time applied at draw, never stored, so
 * scrubbing and export stay reproducible.
 */
export class ParticleField {
  private curX = new Float32Array(0);
  private curY = new Float32Array(0);
  private tgtX = new Float32Array(0);
  private tgtY = new Float32Array(0);
  private velX = new Float32Array(0);
  private velY = new Float32Array(0);
  private phase = new Float32Array(0);

  count = 0;

  setTargets(points: ShapePoint[], centerX: number, centerY: number): void {
    const next = points.length;
    const nextX = new Float32Array(next);
    const nextY = new Float32Array(next);
    const nextTgtX = new Float32Array(next);
    const nextTgtY = new Float32Array(next);
    const nextVelX = new Float32Array(next);
    const nextVelY = new Float32Array(next);
    const nextPhase = new Float32Array(next);

    for (let index = 0; index < next; index += 1) {
      const point = points[index];

      nextTgtX[index] = point.x;
      nextTgtY[index] = point.y;
      nextPhase[index] = index * 0.6180339887; // golden-ratio spread

      if (index < this.count) {
        // Preserve identity so existing particles morph from their live spot.
        nextX[index] = this.curX[index];
        nextY[index] = this.curY[index];
        nextVelX[index] = this.velX[index];
        nextVelY[index] = this.velY[index];
      } else {
        // New particles fade in from the center of the cloud.
        nextX[index] = centerX;
        nextY[index] = centerY;
      }
    }

    this.curX = nextX;
    this.curY = nextY;
    this.tgtX = nextTgtX;
    this.tgtY = nextTgtY;
    this.velX = nextVelX;
    this.velY = nextVelY;
    this.phase = nextPhase;
    this.count = next;
  }

  /** Critically-damped spring step toward targets. */
  update(dtSeconds: number): void {
    const dt = Math.min(0.05, Math.max(0, dtSeconds));
    const stiffness = 120;
    const damping = 2 * Math.sqrt(stiffness);

    for (let index = 0; index < this.count; index += 1) {
      const ax = -stiffness * (this.curX[index] - this.tgtX[index]) - damping * this.velX[index];
      const ay = -stiffness * (this.curY[index] - this.tgtY[index]) - damping * this.velY[index];

      this.velX[index] += ax * dt;
      this.velY[index] += ay * dt;
      this.curX[index] += this.velX[index] * dt;
      this.curY[index] += this.velY[index] * dt;
    }
  }

  /** Snap every particle to its target — used before deterministic export. */
  settle(): void {
    this.curX.set(this.tgtX);
    this.curY.set(this.tgtY);
    this.velX.fill(0);
    this.velY.fill(0);
  }

  getX(index: number): number {
    return this.curX[index];
  }

  getY(index: number): number {
    return this.curY[index];
  }

  getPhase(index: number): number {
    return this.phase[index];
  }
}

export type DrawOptions = {
  accentAmount: number; // 0..1 fraction of particles tinted with accentColor
  accentColor: string;
  baseColor: string;
  dotSize: number;
  field: ParticleField;
  loopProgress: number; // 0..1 within the timeline loop
  motionAmplitude: number;
  motionCycles: number;
  roundness: number; // 0 = square, 1 = full circle
};

const TWO_PI = Math.PI * 2;

/**
 * Pure draw pass in canvas coordinates. Shared by the live preview and the PNG
 * export helper. Ambient drift is a seamless sine of `loopProgress` so the
 * first and last loop frames stitch with no visible jump.
 */
export function drawShapeMorph(context: CanvasRenderingContext2D, options: DrawOptions): void {
  const {
    accentAmount,
    accentColor,
    baseColor,
    dotSize,
    field,
    loopProgress,
    motionAmplitude,
    motionCycles,
    roundness,
  } = options;
  const half = dotSize / 2;
  const wave = TWO_PI * motionCycles * loopProgress;
  // Corner radius interpolates square → circle; a full circle is a rounded
  // rect whose radius is half the side.
  const cornerRadius = Math.max(0, Math.min(1, roundness)) * half;
  const rounded = cornerRadius > 0.05 && typeof context.roundRect === "function";
  // Sampled points arrive shuffled, so tinting the first N indices is a
  // spatially uniform accent. Evaluated per frame — the Amount slider re-tints
  // live with no re-sampling.
  const accentCount = Math.round(field.count * Math.max(0, Math.min(1, accentAmount)));

  // Two fill passes keep fillStyle switches out of the hot loop; rounded
  // particles batch into one path per pass so there is a single fill call.
  for (let pass = 0; pass < 2; pass += 1) {
    const wantAccent = pass === 1;

    context.fillStyle = wantAccent ? accentColor : baseColor;

    if (rounded) {
      context.beginPath();
    }

    for (let index = 0; index < field.count; index += 1) {
      if (index < accentCount !== wantAccent) {
        continue;
      }

      const phase = field.getPhase(index);
      const driftX = Math.sin(wave + phase * TWO_PI) * motionAmplitude;
      const driftY = Math.cos(wave + phase * TWO_PI * 1.3) * motionAmplitude;
      const x = field.getX(index) + driftX - half;
      const y = field.getY(index) + driftY - half;

      if (rounded) {
        context.roundRect(x, y, dotSize, dotSize, cornerRadius);
      } else {
        context.fillRect(x, y, dotSize, dotSize);
      }
    }

    if (rounded) {
      context.fill();
    }
  }
}
