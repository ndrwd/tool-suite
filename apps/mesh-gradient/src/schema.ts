import type { AppSchema } from "@tools/runtime";

/**
 * Mesh Gradient control schema. The runtime renders the panel from this data
 * and seeds `AppState.values` from each control's `target` + `defaultValue`.
 */
export const appSchema: AppSchema = {
  title: "Mesh Gradient",
  canvas: { size: { width: 1920, height: 1080 }, renderScale: 1, aspect: "16:9" },
  timeline: { durationSeconds: 8 },
  sections: [
    {
      title: "Mesh",
      controls: [
        { key: "spread", type: "slider", target: "mesh.spread", label: "Spread", min: 10, max: 150, step: 1, unit: "%", defaultValue: 55 },
        { key: "blur", type: "slider", target: "mesh.blur", label: "Blend", min: 0, max: 300, step: 1, unit: "px", defaultValue: 80 },
      ],
    },
    {
      title: "Motion",
      controls: [
        { key: "amplitude", type: "slider", target: "motion.amplitude", label: "Drift", min: 0, max: 400, step: 1, unit: "px", defaultValue: 90 },
      ],
    },
    {
      title: "Texture",
      controls: [
        { key: "grain", type: "slider", target: "texture.grain", label: "Grain", min: 0, max: 100, step: 1, unit: "%", defaultValue: 8 },
      ],
    },
    {
      title: "Background",
      headerControl: "includeBackground",
      controls: [
        { key: "includeBackground", type: "switch", target: "export.includeBackground", label: "Include", defaultValue: true },
        { key: "canvas", type: "canvas", target: "canvas" },
        { key: "background", type: "color", target: "scene.background", label: "Color", defaultValue: "#0A0A0F" },
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
