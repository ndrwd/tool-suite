"use client";

import * as React from "react";

import { getLoopProgress, shouldIncludePreviewBackground, useStore } from "@tools/runtime";
import { ColorPicker, SectionAction, Slider } from "@tools/ui";

import { buildMesh, drawMeshGradient, type MeshBlob } from "./engine";
import {
  MESH_TARGETS,
  NODE_PALETTE,
  readMeshGradientSettings,
  type MeshGradientSettings,
  type MeshNode,
} from "./settings";

type FrameState = {
  blobs: MeshBlob[];
  includeBackground: boolean;
  loopProgress: number;
  renderScale: number;
  settings: MeshGradientSettings;
  size: { height: number; width: number };
};

function createNodeId(): string {
  return `n${Math.random().toString(36).slice(2, 9)}`;
}

/** Hand-rolled to match @tools/ui's own icons (Chevron) — the shared package
 * carries no icon dependency, and lucide is city48-only. */
function TrashIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
    </svg>
  );
}

/**
 * Custom Canvas 2D product renderer plus its direct-manipulation layer. Nodes
 * are authored on the canvas — drag to move, double-click empty space to add,
 * click to select and edit color/size.
 *
 * Handles track each node's BASE position, not its drifted position: chasing a
 * moving target while the timeline plays would be unusable, and drift is
 * animation around the authored point rather than a property of it.
 */
export function MeshGradientCanvas(): React.JSX.Element {
  const { state, setValue } = useStore();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const frameRef = React.useRef<FrameState | null>(null);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  // While dragging, nodes live in local state so the canvas updates every
  // pointermove without pushing 60 undo entries per second; the store is
  // committed once on pointerup.
  const [draftNodes, setDraftNodes] = React.useState<MeshNode[] | null>(null);

  const settings = React.useMemo(
    () => readMeshGradientSettings(state.values),
    [state.values],
  );
  const nodes = draftNodes ?? settings.nodes;
  const liveSettings = React.useMemo<MeshGradientSettings>(
    () => ({ ...settings, nodes }),
    [settings, nodes],
  );

  const size = state.canvas.size;
  const renderScale =
    Number(state.values["canvas.renderScale"] ?? state.canvas.renderScale ?? 1) || 1;
  const includeBackground = shouldIncludePreviewBackground(state);
  const loopProgress = getLoopProgress(state.timeline);

  const blobs = React.useMemo(
    () => buildMesh(liveSettings, size.width, size.height),
    [liveSettings, size.width, size.height],
  );

  frameRef.current = {
    blobs,
    includeBackground,
    loopProgress,
    renderScale,
    settings: liveSettings,
    size: { height: size.height, width: size.width },
  };

  const commitNodes = React.useCallback(
    (next: MeshNode[]) => {
      setValue(MESH_TARGETS.nodes, next);
    },
    [setValue],
  );

  const detachDragRef = React.useRef<(() => void) | null>(null);

  /** Viewport point → normalized 0..1 canvas coordinates. */
  const toNormalized = React.useCallback((clientX: number, clientY: number) => {
    const box = boxRef.current;

    if (!box) {
      return { x: 0.5, y: 0.5 };
    }

    const rect = box.getBoundingClientRect();

    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }, []);

  /**
   * Drag is tracked on `window`, and the listeners are attached synchronously
   * here rather than from an effect. Two reasons, both load-bearing: pointer
   * capture drops the drag as soon as the cursor outruns the small hit target,
   * and an effect would only attach after the next render — long enough to miss
   * the opening pointermove of a fast drag.
   */
  const handleHandlePointerDown = React.useCallback(
    (event: React.PointerEvent, nodeId: string) => {
      event.stopPropagation();
      event.preventDefault();
      setSelectedId(nodeId);

      const startNodes = nodes;
      setDraftNodes(startNodes);

      const onMove = (moveEvent: PointerEvent): void => {
        const { x, y } = toNormalized(moveEvent.clientX, moveEvent.clientY);

        setDraftNodes((current) =>
          (current ?? startNodes).map((node) =>
            node.id === nodeId
              ? {
                  ...node,
                  x: Math.max(-0.2, Math.min(1.2, x)),
                  y: Math.max(-0.2, Math.min(1.2, y)),
                }
              : node,
          ),
        );
      };

      const onUp = (): void => {
        detachDragRef.current?.();
        detachDragRef.current = null;

        // Commit once, from the freshest draft — one undo entry per drag rather
        // than one per pointermove.
        setDraftNodes((current) => {
          if (current) {
            commitNodes(current);
          }

          return null;
        });
      };

      detachDragRef.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [commitNodes, nodes, toNormalized],
  );

  // Drop any in-flight drag listeners if the canvas unmounts mid-drag.
  React.useEffect(() => () => detachDragRef.current?.(), []);

  const handleAddNode = React.useCallback(
    (event: React.MouseEvent) => {
      const { x, y } = toNormalized(event.clientX, event.clientY);
      const next: MeshNode = {
        color: NODE_PALETTE[nodes.length % NODE_PALETTE.length],
        id: createNodeId(),
        scale: 1,
        x,
        y,
      };

      commitNodes([...nodes, next]);
      setSelectedId(next.id);
    },
    [commitNodes, nodes, toNormalized],
  );

  const updateSelected = React.useCallback(
    (patch: Partial<MeshNode>) => {
      commitNodes(nodes.map((node) => (node.id === selectedId ? { ...node, ...patch } : node)));
    },
    [commitNodes, nodes, selectedId],
  );

  const deleteSelected = React.useCallback(() => {
    // One node must survive — an empty mesh renders a blank frame with no way
    // back except double-clicking, which is not obvious after the fact.
    if (nodes.length <= 1) {
      return;
    }

    commitNodes(nodes.filter((node) => node.id !== selectedId));
    setSelectedId(null);
  }, [commitNodes, nodes, selectedId]);

  // Escape clears selection; Delete removes the selected node.
  React.useEffect(() => {
    if (!selectedId) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;

      // Never hijack keys while typing in the panel's inputs.
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }

      if (event.key === "Escape") {
        setSelectedId(null);
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelected();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, selectedId]);

  // Single persistent animation loop.
  React.useEffect(() => {
    let raf = 0;

    const tick = (): void => {
      raf = requestAnimationFrame(tick);

      const frame = frameRef.current;
      const canvas = canvasRef.current;

      if (!frame || !canvas) {
        return;
      }

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

      context.setTransform(frame.renderScale, 0, 0, frame.renderScale, 0, 0);
      context.clearRect(0, 0, frame.size.width, frame.size.height);

      if (frame.includeBackground) {
        context.fillStyle = frame.settings.background;
        context.fillRect(0, 0, frame.size.width, frame.size.height);
      }

      drawMeshGradient(context, {
        blobs: frame.blobs,
        blur: frame.settings.blur,
        grain: frame.settings.grain,
        height: frame.size.height,
        loopProgress: frame.loopProgress,
        motionAmplitude: frame.settings.motionAmplitude,
        width: frame.size.width,
      });
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, []);

  const selectedNode = nodes.find((node) => node.id === selectedId) ?? null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3">
      {/* The wrapper shrink-wraps the canvas: the canvas is a replaced element,
       * so max-w/max-h contain it while preserving its intrinsic ratio, and the
       * wrapper then matches its box exactly — which is what keeps the absolute
       * node handles aligned to canvas coordinates. */}
      <div
        className="relative min-h-0 max-h-full max-w-full"
        onDoubleClick={handleAddNode}
        onPointerDown={() => setSelectedId(null)}
        ref={boxRef}
      >
        <canvas
          className="block max-h-full max-w-full"
          data-mesh-gradient-output="mesh-gradient"
          ref={canvasRef}
          style={{ aspectRatio: `${size.width} / ${size.height}` }}
        />

        {nodes.map((node) => (
          <button
            aria-label={`Mesh node ${node.color}`}
            className={
              selectedId === node.id
                ? "absolute size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] active:cursor-grabbing"
                : "absolute size-3 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border border-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.5)] hover:size-4 active:cursor-grabbing"
            }
            key={node.id}
            onPointerDown={(event) => handleHandlePointerDown(event, node.id)}
            style={{
              backgroundColor: node.color,
              left: `${node.x * 100}%`,
              top: `${node.y * 100}%`,
            }}
            type="button"
          />
        ))}

        {selectedNode ? (
          <div
            className="absolute z-10 w-52 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg"
            onDoubleClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              left: `${Math.min(Math.max(selectedNode.x, 0), 1) * 100}%`,
              top: `${Math.min(Math.max(selectedNode.y, 0), 1) * 100}%`,
              // Nudge the popover below-right of the handle, flipping near the
              // right/bottom edges so it never leaves the frame.
              transform: `translate(${selectedNode.x > 0.7 ? "-100%" : "0"}, ${
                selectedNode.y > 0.7 ? "-100%" : "0"
              }) translate(${selectedNode.x > 0.7 ? "-14px" : "14px"}, ${
                selectedNode.y > 0.7 ? "-14px" : "14px"
              })`,
            }}
          >
            <SectionAction
              aria-label="Delete node"
              className="absolute right-2 top-2"
              disabled={nodes.length <= 1}
              onClick={deleteSelected}
              title={nodes.length <= 1 ? "The mesh needs at least one node" : "Delete node"}
            >
              <TrashIcon />
            </SectionAction>

            <div className="flex flex-col gap-3">
              <ColorPicker
                onChange={(next) => updateSelected({ color: next })}
                value={selectedNode.color}
              />
              <Slider
                label="Size"
                max={300}
                min={20}
                onChange={(next) => updateSelected({ scale: next / 100 })}
                step={1}
                unit="%"
                value={Math.round(selectedNode.scale * 100)}
              />
            </div>
          </div>
        ) : null}
      </div>

      <p className="text-2xs text-[var(--muted-foreground)]">
        Drag nodes to move · double-click canvas to add · click a node to edit
      </p>
    </div>
  );
}
