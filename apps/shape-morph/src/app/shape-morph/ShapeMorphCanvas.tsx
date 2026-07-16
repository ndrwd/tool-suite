"use client";

import * as React from "react";

import { useStore } from "@tools/runtime";
import { getLoopProgress } from "@tools/runtime";
import { shouldIncludePreviewBackground } from "@tools/runtime";
import { ensureFontLoaded } from "@tools/runtime";

import { ParticleField, drawShapeMorph, sampleTextToPoints } from "./engine";
import {
  readShapeMorphSettings,
  shapeSignature,
  type ShapeMorphSettings,
} from "./settings";

type FrameState = {
  background: string;
  includeBackground: boolean;
  loopProgress: number;
  renderScale: number;
  settings: ShapeMorphSettings;
  size: { height: number; width: number };
};

function createOffscreenCanvas(): HTMLCanvasElement {
  return document.createElement("canvas");
}

/**
 * Custom Canvas 2D product renderer. Runs its own animation loop so the morph
 * springs advance on real dt (even while playback is paused) while the ambient
 * drift stays a deterministic function of timeline loop progress. React state
 * is mirrored into a ref each render so the loop never depends on re-renders.
 */
export function ShapeMorphCanvas(): React.JSX.Element {
  const { state } = useStore();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const fieldRef = React.useRef<ParticleField>(new ParticleField());
  const frameRef = React.useRef<FrameState | null>(null);
  const signatureRef = React.useRef<string>("");
  const resampleTokenRef = React.useRef(0);

  const settings = React.useMemo(
    () => readShapeMorphSettings(state.values),
    [state.values],
  );
  const size = state.canvas.size;
  const renderScale = Number(state.values["canvas.renderScale"] ?? state.canvas.renderScale ?? 1) || 1;
  const includeBackground = shouldIncludePreviewBackground(state);
  const loopProgress = getLoopProgress(state.timeline);

  // Mirror the current frame inputs for the animation loop to read.
  frameRef.current = {
    background: settings.background,
    includeBackground,
    loopProgress,
    renderScale,
    settings,
    size: { height: size.height, width: size.width },
  };

  // Re-sample the target cloud whenever the glyph, layout, or density changes.
  React.useEffect(() => {
    const signature = shapeSignature(settings, size.width, size.height);

    if (signature === signatureRef.current) {
      return;
    }

    signatureRef.current = signature;
    const token = resampleTokenRef.current + 1;
    resampleTokenRef.current = token;

    const applyTargets = (): void => {
      if (resampleTokenRef.current !== token) {
        return;
      }

      const points = sampleTextToPoints(
        settings,
        size.width,
        size.height,
        createOffscreenCanvas,
      );

      fieldRef.current.setTargets(points, size.width / 2, size.height / 2);
    };

    if (settings.fontEntry) {
      void ensureFontLoaded(settings.fontEntry)
        .catch(() => undefined)
        .then(() => {
          if (typeof document !== "undefined" && "fonts" in document) {
            return document.fonts
              .load(`${settings.fontWeight} 64px "${settings.fontFamily}"`)
              .catch(() => undefined);
          }

          return undefined;
        })
        .then(applyTargets);
    } else {
      applyTargets();
    }
  }, [settings, size.width, size.height]);

  // Single persistent animation loop.
  React.useEffect(() => {
    let raf = 0;
    let previous = 0;

    const tick = (timestamp: number): void => {
      const frame = frameRef.current;
      const canvas = canvasRef.current;

      raf = requestAnimationFrame(tick);

      if (!frame || !canvas) {
        previous = timestamp;
        return;
      }

      const dt = previous === 0 ? 0 : (timestamp - previous) / 1000;
      previous = timestamp;

      const backingWidth = Math.max(1, Math.round(frame.size.width * frame.renderScale));
      const backingHeight = Math.max(1, Math.round(frame.size.height * frame.renderScale));

      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }

      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      fieldRef.current.update(dt);

      context.setTransform(frame.renderScale, 0, 0, frame.renderScale, 0, 0);
      context.clearRect(0, 0, frame.size.width, frame.size.height);

      if (frame.includeBackground) {
        context.fillStyle = frame.background;
        context.fillRect(0, 0, frame.size.width, frame.size.height);
      }

      drawShapeMorph(context, {
        accentAmount: frame.settings.accentAmount,
        accentColor: frame.settings.accentColor,
        baseColor: frame.settings.baseColor,
        dotSize: frame.settings.dotSize,
        field: fieldRef.current,
        loopProgress: frame.loopProgress,
        motionAmplitude: frame.settings.motionAmplitude,
        motionCycles: frame.settings.motionCycles,
        roundness: frame.settings.roundness,
      });
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      className="block h-full w-full object-contain"
      data-shape-morph-output="shape-morph"
      ref={canvasRef}
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
    />
  );
}
