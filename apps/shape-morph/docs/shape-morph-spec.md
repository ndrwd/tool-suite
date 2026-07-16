# Shape Morph — Product Spec

Shape Morph dissolves typed text into an animated particle cloud. Users pick a
Google font (family, weight, size, case, base color/opacity, letter spacing,
line height), tune the shape field (density, dot size, roundness, jitter),
tint an accent share of particles, and drive a seamless drift loop from the
playback timeline. Changing the text or any sampling input morphs the existing
particles into the new glyph with a critically-damped spring. Delivery is a
sticky-footer Export PNG (2K/4K/8K stills) and Export Video (one seamless loop,
MP4/WebM at Current/4K).

## Renderer Technique Decision Matrix

| Field | Decision |
| --- | --- |
| sourceRepresentation | `canvas-2d` — the glyph is rasterized to an offscreen canvas and sampled into particle targets on control commits. |
| productRepresentation | `pixel` — the product is the particle bitmap itself, not selectable text. |
| previewRenderer | `canvas-2d` — one visible canvas, two batched fills per frame (base + accent). |
| exportRenderer | `canvas-2d` — PNG via `createPngExportCanvas`, video via `canvas.captureStream` + MediaRecorder; both call the same pure `drawShapeMorph`, so export/copy output is product-quality and identical to the preview. |
| rendererWorkload | `pixel-output` — up to 900 particles drawn per frame at render scale. |
| rendererStrategy | `canvas-2d` (provisional choice accepted after measurement, see below). |
| whyNotAlternativeStrategies | WebGL: measured worst case (900 particles, 24px rounded dots, full motion, max render scale, 2880x1620 backing) holds ~70fps avg / p95 25ms / max 41.7ms in the agent browser — GPU batching adds complexity without a measured need. SVG/DOM: 900 nodes re-positioned per frame would thrash layout/style; a single canvas batch is strictly cheaper for pixel-output. |
| fidelityRisks | Tiny font sizes lower sampling fidelity; MediaRecorder real-time encode can drop frames on slow machines. |
| performanceRisks | All passes run on the main thread; the 900-particle cap and batched fills bound the frame cost (~14ms measured worst case). Glyph re-sampling reads pixels only on text/font/density/jitter commits (<50ms at max density), never per frame. |

## Renderer Layer Inventory

- `scene-background` — background layer, single fill of `scene.background`,
  low primitive count, included in export, `uiSelector`
  `[data-shape-morph-output="shape-morph"]`.
- `particle-field` — product-foreground layer, medium primitive count
  (≤900 rounded rects), included in export. Intentional rasterization: the
  discrete particle cloud is the product output; there is no semantic text or
  vector foreground to preserve.
- No editing-handles layer (no direct canvas manipulation) and no separate
  export-composite layer (export re-renders the same two layers).

## Render Pipeline Inventory

Passes:

1. `sample-glyph` (text-layout, main) — rasterize text offscreen and sample
   `field.density` stratified targets. cacheKey: `text.content`, `text.font`,
   `field.density`, `field.jitter`, `canvas.size`. Invalidated only by those
   targets — never by draw-phase controls, viewport, or playback.
2. `draw-particles` (composite, main, retina quality) — spring-advance the
   field and batch-fill base + accent passes each animation-frame. Invalidated
   by draw-phase targets (`field.dotSize`, `field.roundness`, `accent.*`,
   `motion.*`, `scene.background`, `export.includeBackground`); must not
   invalidate `sample-glyph`.
3. `export-frame` (export-only) — settled field rendered at export size;
   invalidated by `export.image.*` / `export.video.*` settings.

Interaction invalidation: `control-change` on sampling targets invalidates
`sample-glyph` + `draw-particles`; `control-drag` on draw-phase targets
invalidates only `draw-particles`; viewport-drag / viewport-zoom /
timeline-playback and animation-frame ticks invalidate nothing cache-sensitive
(drift is a pure function of timeline loop progress evaluated inside the
per-frame composite); `export` interactions invalidate only `export-frame`.

## Animation Intent Inventory

- Mode: playback timeline (top transport). Product animation is an autonomous
  seamless drift; users need play/pause/scrub/duration and video export, not
  property keyframes.
- Loop duration: 6s, product-derived — whole sine cycles per loop stitch the
  first and last frames with no visible jump; forward-only, no reverse, no
  mirror, no yo-yo, no ping-pong. Editing the duration stretches the same
  cycles in time.

## Control Sections

Setup (runtime) → Text → Typography (`fontPicker`) → Shape field (Density,
Size, Roundness, Jitter) → Accent (Color, Amount) → Motion (Drift, Speed) →
Background (Include + color) → Image export (Format, Resolution) →
Video export (Format, Resolution) → sticky Export PNG / Export Video.

## Persistence

`localStorage` (`shape-morph:state:v1`), slices: values, canvas,
panels, timeline. Reload restoration is covered by browser acceptance.
