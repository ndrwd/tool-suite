import type { FontValue } from "./types";

/**
 * Generic control-schema types shared by every tool. A tool expresses its
 * controls as plain data (an `AppSchema`); the runtime renders the panel and
 * seeds state from it. Each control's `target` is the key it reads and writes
 * in `AppState.values`.
 */

type ControlBase = {
  key: string;
  target: string;
  label?: string | false;
  description?: string;
};

export type TextControl = ControlBase & {
  type: "text";
  defaultValue: string;
};

export type SliderControl = ControlBase & {
  type: "slider";
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
};

export type ColorControl = ControlBase & {
  type: "color";
  defaultValue: string;
};

export type SwitchControl = ControlBase & {
  type: "switch";
  defaultValue: boolean;
};

export type SelectControl = ControlBase & {
  type: "select";
  defaultValue: string;
  options: Array<{ label: string; value: string }>;
};

export type FontPickerControl = ControlBase & {
  type: "fontPicker";
  defaultValue: FontValue;
};

export type ActionsControl = ControlBase & {
  type: "panelActions";
  actions: Array<{ label: string; value: string }>;
};

/** Canvas output settings (aspect ratio + width/height); reads from AppState.canvas. */
export type CanvasControl = ControlBase & {
  type: "canvas";
};

export type Control =
  | TextControl
  | SliderControl
  | ColorControl
  | SwitchControl
  | SelectControl
  | FontPickerControl
  | ActionsControl
  | CanvasControl;

export type LayoutGroup = { columns: number; controls: string[] };

export type Section = {
  title: string;
  controls: Control[];
  layoutGroups?: LayoutGroup[];
  /** Control key rendered inline in the section header (e.g. an enable switch). */
  headerControl?: string;
};

export type AppSchema = {
  title: string;
  canvas: { size: { width: number; height: number }; renderScale: number; aspect: string };
  timeline: { durationSeconds: number };
  sections: Section[];
};

/** All control default values keyed by target — used to seed `AppState.values`. */
export function buildDefaultValues(schema: AppSchema): Record<string, unknown> {
  const values: Record<string, unknown> = { "canvas.renderScale": schema.canvas.renderScale };

  for (const section of schema.sections) {
    for (const control of section.controls) {
      if (control.type === "panelActions" || control.type === "canvas") {
        continue;
      }

      values[control.target] = control.defaultValue;
    }
  }

  return values;
}
