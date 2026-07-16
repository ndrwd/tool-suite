import * as React from "react";

import { useStore } from "../store";
import { FONT_CATALOG, getFontById } from "../fonts/catalog";
import { ensureFontLoaded } from "../fonts/loader";
import type { FontValue } from "../types";
import type {
  ColorControl as ColorControlSchema,
  Control,
  FontPickerControl as FontPickerControlSchema,
  SelectControl as SelectControlSchema,
  SliderControl as SliderControlSchema,
  SwitchControl as SwitchControlSchema,
  TextControl as TextControlSchema,
} from "../schema";

import { Button, ColorField, FieldLabel, Select, Slider, TextInput, Toggle } from "@tools/ui";
import { CanvasControls } from "./CanvasControls";

function useValue<T>(target: string, fallback: T): [T, (next: T) => void] {
  const { state, setValue } = useStore();
  const raw = state.values[target];
  const value = (raw === undefined ? fallback : raw) as T;
  return [value, (next: T) => setValue(target, next)];
}

function TextField({ control }: { control: TextControlSchema }): React.JSX.Element {
  const [value, setValue] = useValue<string>(control.target, control.defaultValue);

  return (
    <label className="flex flex-col gap-1.5">
      {control.label !== false ? <FieldLabel>{control.label ?? control.key}</FieldLabel> : null}
      <TextInput onChange={(event) => setValue(event.target.value)} value={value} />
    </label>
  );
}

function SliderField({ control }: { control: SliderControlSchema }): React.JSX.Element {
  const [value, setValue] = useValue<number>(control.target, control.defaultValue);
  const display = control.step < 1 ? value.toFixed(2) : String(Math.round(value));

  return (
    <Slider
      display={display}
      label={control.label ?? control.key}
      max={control.max}
      min={control.min}
      onChange={setValue}
      step={control.step}
      unit={control.unit}
      value={value}
    />
  );
}

function ColorField_({ control }: { control: ColorControlSchema }): React.JSX.Element {
  const [value, setValue] = useValue<string>(control.target, control.defaultValue);
  return <ColorField label={control.label ?? control.key} onChange={setValue} value={value} />;
}

function SwitchField({ control }: { control: SwitchControlSchema }): React.JSX.Element {
  const [value, setValue] = useValue<boolean>(control.target, control.defaultValue);

  return (
    <label className="flex items-center justify-between gap-2">
      <FieldLabel>{control.label ?? control.key}</FieldLabel>
      <Toggle checked={value} onChange={setValue} />
    </label>
  );
}

/** Toggle-only switch for placing at a section header (no inline label). */
export function HeaderSwitch({ control }: { control: SwitchControlSchema }): React.JSX.Element {
  const [value, setValue] = useValue<boolean>(control.target, control.defaultValue);
  const ariaLabel = typeof control.label === "string" ? control.label : control.key;
  return <Toggle aria-label={ariaLabel} checked={value} onChange={setValue} />;
}

function SelectField({ control }: { control: SelectControlSchema }): React.JSX.Element {
  const [value, setValue] = useValue<string>(control.target, control.defaultValue);

  return (
    <Select
      label={control.label !== false ? (control.label ?? control.key) : false}
      onChange={setValue}
      options={control.options}
      value={value}
    />
  );
}

function FontPickerField({ control }: { control: FontPickerControlSchema }): React.JSX.Element {
  const [value, setValue] = useValue<FontValue>(control.target, control.defaultValue);

  const patch = (next: Partial<FontValue>): void => setValue({ ...value, ...next });

  const entry = getFontById(value.fontId);
  const weights = entry?.weights ?? ["400", "700"];

  return (
    <div className="flex flex-col gap-2.5">
      <Select
        label="Font"
        onChange={(next) => {
          const nextEntry = getFontById(next);
          void ensureFontLoaded(nextEntry);
          const nextWeights = nextEntry?.weights ?? weights;
          patch({
            fontId: next,
            fontWeight: nextWeights.includes(value.fontWeight ?? "") ? value.fontWeight : (nextWeights.at(-1) ?? "400"),
          });
        }}
        options={FONT_CATALOG.map((font) => ({ value: font.id, label: font.family }))}
        value={value.fontId}
      />

      <Select
        label="Weight"
        onChange={(next) => patch({ fontWeight: next })}
        options={weights.map((weight) => ({ value: weight, label: weight }))}
        value={value.fontWeight ?? "400"}
      />

      <ColorField label="Color" onChange={(next) => patch({ color: next })} value={value.color ?? "#FFFFFF"} />

      <Slider
        display={String(Math.round(value.fontSize ?? 600))}
        label="Size"
        max={1200}
        min={40}
        onChange={(next) => patch({ fontSize: next })}
        step={2}
        value={value.fontSize ?? 600}
      />
    </div>
  );
}

export function ControlRenderer({
  control,
  onAction,
}: {
  control: Control;
  onAction: (value: string) => void;
}): React.JSX.Element | null {
  switch (control.type) {
    case "text":
      return <TextField control={control} />;
    case "slider":
      return <SliderField control={control} />;
    case "color":
      return <ColorField_ control={control} />;
    case "switch":
      return <SwitchField control={control} />;
    case "select":
      return <SelectField control={control} />;
    case "fontPicker":
      return <FontPickerField control={control} />;
    case "canvas":
      return <CanvasControls />;
    case "panelActions":
      return (
        <div className="grid grid-cols-2 gap-2">
          {control.actions.map((action) => (
            <Button key={action.value} onClick={() => onAction(action.value)}>
              {action.label}
            </Button>
          ))}
        </div>
      );
    default:
      return null;
  }
}
