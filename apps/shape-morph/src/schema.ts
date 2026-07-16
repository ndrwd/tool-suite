import type { AppSchema } from "@tools/runtime";

/**
 * Shape Morph control schema. The runtime renders the panel from this data and
 * seeds `AppState.values` from each control's `target` + `defaultValue`.
 */
export const appSchema: AppSchema = {
  title: "Shape Morph",
  canvas: { size: { width: 1080, height: 1080 }, renderScale: 1, aspect: "1:1" },
  timeline: { durationSeconds: 6 },
  sections: [
    {
      title: "Text",
      controls: [
        {
          key: "text",
          type: "text",
          target: "text.content",
          label: false,
          defaultValue: "❤️",
        },
      ],
    },
    {
      title: "Typography",
      controls: [
        {
          key: "font",
          type: "fontPicker",
          target: "text.font",
          defaultValue: {
            color: "#FFFFFF",
            fontId: "lato",
            fontSize: 614,
            fontWeight: "900",
            letterSpacing: "normal",
            opacity: 100,
            textCase: "uppercase",
          },
        },
      ],
    },
    {
      title: "Shape field",
      controls: [
        { key: "density", type: "slider", target: "field.density", label: "Density", min: 60, max: 900, step: 10, defaultValue: 900 },
        { key: "dotSize", type: "slider", target: "field.dotSize", label: "Size", min: 1, max: 24, step: 1, unit: "px", defaultValue: 3 },
        { key: "roundness", type: "slider", target: "field.roundness", label: "Roundness", min: 0, max: 100, step: 1, unit: "%", defaultValue: 100 },
        { key: "jitter", type: "slider", target: "field.jitter", label: "Jitter", min: 0, max: 1, step: 0.01, defaultValue: 0.3 },
      ],
    },
    {
      title: "Accent",
      controls: [
        { key: "accentColor", type: "color", target: "accent.color", label: "Color", defaultValue: "#DB0000" },
        { key: "accentAmount", type: "slider", target: "accent.amount", label: "Amount", min: 0, max: 100, step: 1, unit: "%", defaultValue: 30 },
      ],
    },
    {
      title: "Motion",
      controls: [
        { key: "amplitude", type: "slider", target: "motion.amplitude", label: "Drift", min: 0, max: 40, step: 1, unit: "px", defaultValue: 15 },
        { key: "speed", type: "slider", target: "motion.speed", label: "Speed", min: 0, max: 100, step: 1, defaultValue: 30 },
      ],
    },
    {
      title: "Background",
      headerControl: "includeBackground",
      controls: [
        { key: "includeBackground", type: "switch", target: "export.includeBackground", label: "Include", defaultValue: true },
        { key: "canvas", type: "canvas", target: "canvas" },
        { key: "background", type: "color", target: "scene.background", label: "Color", defaultValue: "#09080C" },
      ],
    },
    {
      title: "Image export",
      controls: [
        {
          key: "imageFormat",
          type: "select",
          target: "export.image.format",
          label: "Format",
          defaultValue: "png",
          options: [
            { label: "PNG", value: "png" },
            { label: "JPG", value: "jpg" },
          ],
        },
        {
          key: "imageResolution",
          type: "select",
          target: "export.image.resolution",
          label: "Resolution",
          defaultValue: "4k",
          options: [
            { label: "2K", value: "2k" },
            { label: "4K", value: "4k" },
            { label: "8K", value: "8k" },
          ],
        },
      ],
      layoutGroups: [{ columns: 2, controls: ["imageFormat", "imageResolution"] }],
    },
    {
      title: "Video export",
      controls: [
        {
          key: "videoFormat",
          type: "select",
          target: "export.video.format",
          label: "Format",
          defaultValue: "mp4",
          options: [
            { label: "MP4", value: "mp4" },
            { label: "WebM", value: "webm" },
          ],
        },
        {
          key: "videoResolution",
          type: "select",
          target: "export.video.resolution",
          label: "Resolution",
          defaultValue: "current",
          options: [
            { label: "Current", value: "current" },
            { label: "4K", value: "4k" },
          ],
        },
      ],
      layoutGroups: [{ columns: 2, controls: ["videoFormat", "videoResolution"] }],
    },
    {
      title: "Export",
      controls: [
        {
          key: "exportActions",
          type: "panelActions",
          target: "export.actions",
          actions: [
            { label: "PNG", value: "export-png" },
            { label: "Video", value: "export-video" },
          ],
        },
      ],
    },
  ],
};
