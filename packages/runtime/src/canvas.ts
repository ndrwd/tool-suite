/** Aspect-ratio presets for the canvas output size. */
export const ASPECT_PRESETS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "4:5": { width: 1080, height: 1350 },
  "4:3": { width: 1440, height: 1080 },
  "3:2": { width: 1620, height: 1080 },
};

export const ASPECT_OPTIONS: Array<{ label: string; value: string }> = [
  ...Object.keys(ASPECT_PRESETS).map((value) => ({ label: value, value })),
  { label: "Custom", value: "custom" },
];
