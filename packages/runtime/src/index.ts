// Shell
export { ToolApp, type ToolActionHandler } from "./ToolApp";

// Store
export { StoreProvider, useStore } from "./store";

// Schema types + helpers
export {
  buildDefaultValues,
  type ActionsControl,
  type AppSchema,
  type CanvasControl,
  type ColorControl,
  type Control,
  type FontPickerControl,
  type LayoutGroup,
  type Section,
  type SelectControl,
  type SliderControl,
  type SwitchControl,
  type TextControl,
} from "./schema";

// State types
export type { AppState, CanvasState, FontValue, TimelineState, Theme } from "./types";

// Canvas + timeline
export { ASPECT_OPTIONS, ASPECT_PRESETS } from "./canvas";
export { getLoopProgress, getLoopTime } from "./timeline-utils";

// Export helpers
export {
  createPngExportCanvas,
  getImageExportSize,
  getVideoExportSize,
  shouldIncludePreviewBackground,
  type PngRenderContext,
  type RetinaExportSize,
} from "./export-utils";

// Fonts
export {
  FONT_CATALOG,
  FONT_FILTER_OPTIONS,
  buildGoogleStylesheetHref,
  getFontById,
  type FontCatalogEntry,
  type FontCategory,
} from "./fonts/catalog";
export { ensureFontLoaded } from "./fonts/loader";
