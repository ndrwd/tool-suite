import {
  createPngExportCanvas,
  getVideoExportSize,
  shouldIncludePreviewBackground,
} from "@tools/runtime";
import { getLoopProgress } from "@tools/runtime";
import type { AppState } from "@tools/runtime";

import { ParticleField, drawShapeMorph, sampleTextToPoints } from "./engine";
import { readShapeMorphBackground, readShapeMorphSettings } from "./settings";

function createOffscreenCanvas(): HTMLCanvasElement {
  return document.createElement("canvas");
}

function buildSettledField(
  state: AppState,
  width: number,
  height: number,
): { field: ParticleField; settings: ReturnType<typeof readShapeMorphSettings> } {
  const settings = readShapeMorphSettings(state.values);
  const points = sampleTextToPoints(settings, width, height, createOffscreenCanvas);
  const field = new ParticleField();

  field.setTargets(points, width / 2, height / 2);
  field.settle();

  return { field, settings };
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.download = fileName;
  anchor.href = url;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export the current frame as a still at the selected image resolution. */
export async function exportShapeMorphPng(state: AppState): Promise<void> {
  const includeBackground = shouldIncludePreviewBackground(state);
  const imageResolution = String(state.values["export.image.resolution"] ?? "4k");
  const format = String(state.values["export.image.format"] ?? "png");
  const loopProgress = getLoopProgress(state.timeline);

  const canvas = createPngExportCanvas({
    background: readShapeMorphBackground(state.values),
    includeBackground,
    render: ({ context, cssHeight, cssWidth }) => {
      const { field, settings } = buildSettledField(state, cssWidth, cssHeight);

      drawShapeMorph(context, {
        accentAmount: settings.accentAmount,
        accentColor: settings.accentColor,
        baseColor: settings.baseColor,
        dotSize: settings.dotSize,
        field,
        loopProgress,
        motionAmplitude: settings.motionAmplitude,
        motionCycles: settings.motionCycles,
        roundness: settings.roundness,
      });
    },
    resolution: imageResolution,
    state,
  });

  const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mimeType, 0.95),
  );

  if (blob) {
    downloadBlob(blob, `shape-morph.${format === "jpg" ? "jpg" : "png"}`);
  }
}

function pickVideoMimeType(format: string): string {
  const candidates =
    format === "webm"
      ? ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
      : ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];

  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return "video/webm";
}

/**
 * Export the seamless drift loop as a video. Frames are driven off timeline
 * loop progress (0..1 across the runtime duration) so the encoded clip length
 * matches the edited timeline duration and the loop stitches cleanly.
 */
export async function exportShapeMorphVideo(
  state: AppState,
  reportProgress: (progress: number) => void,
): Promise<void> {
  if (typeof MediaRecorder === "undefined") {
    return;
  }

  const format = String(state.values["export.video.format"] ?? "mp4");
  const resolution = String(state.values["export.video.resolution"] ?? "current");
  const { height, pixelRatio, width } = getVideoExportSize(resolution, state);
  const durationSeconds = Math.max(1, state.timeline.durationSeconds);
  const fps = 30;

  const canvas = createOffscreenCanvas();
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const cssWidth = state.canvas.size.width;
  const cssHeight = state.canvas.size.height;
  const { field, settings } = buildSettledField(state, cssWidth, cssHeight);
  const background = readShapeMorphBackground(state.values);

  const stream = canvas.captureStream(fps);
  const mimeType = pickVideoMimeType(format);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const finished = new Promise<void>((resolve, reject) => {
    recorder.onerror = (event) => {
      // Reject encoder failures instead of returning a corrupt video blob.
      const errorEvent = event as Event & { error?: unknown };

      reject(
        errorEvent.error instanceof Error
          ? errorEvent.error
          : new Error("MediaRecorder failed while encoding the video export."),
      );
    };
    recorder.onstop = () => resolve();
  });

  recorder.start();

  // Video always keeps the product background even when the PNG Include
  // switch is off.
  const includeVideoBackground = true;

  const drawFrame = (loopProgress: number): void => {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);

    if (includeVideoBackground) {
      context.fillStyle = background;
      context.fillRect(0, 0, cssWidth, cssHeight);
    }

    drawShapeMorph(context, {
      accentAmount: settings.accentAmount,
      accentColor: settings.accentColor,
      baseColor: settings.baseColor,
      dotSize: settings.dotSize,
      field,
      loopProgress,
      motionAmplitude: settings.motionAmplitude,
      motionCycles: settings.motionCycles,
      roundness: settings.roundness,
    });
  };

  // Drive the recording by real elapsed time for exactly one loop so the
  // captured wall-clock duration matches the timeline duration regardless of
  // how fast individual frames render. `captureStream` grabs whatever the
  // canvas shows over that real-time window.
  const minFrameMs = 1000 / fps;

  await new Promise<void>((resolve) => {
    const startTime = performance.now();
    let lastFrameTime = 0;

    const step = (): void => {
      const elapsed = (performance.now() - startTime) / 1000;

      if (elapsed >= durationSeconds) {
        drawFrame(1); // final frame stitches to the loop start
        reportProgress(1);
        resolve();
        return;
      }

      const now = performance.now();

      if (now - lastFrameTime >= minFrameMs) {
        lastFrameTime = now;
        drawFrame((elapsed % durationSeconds) / durationSeconds);
        reportProgress(elapsed / durationSeconds);
      }

      requestAnimationFrame(step);
    };

    drawFrame(0);
    requestAnimationFrame(step);
  });

  reportProgress(1);
  recorder.stop();
  await finished;

  const blob = new Blob(chunks, { type: mimeType });
  const extension = mimeType.includes("mp4") ? "mp4" : "webm";

  downloadBlob(blob, `shape-morph.${extension}`);
}
