import * as React from "react";

import { ASPECT_OPTIONS } from "../canvas";
import { useStore } from "../store";

import { FieldLabel, Select, TextInput } from "@tools/ui";

/** Canvas output settings: aspect ratio preset + editable width/height. */
export function CanvasControls(): React.JSX.Element {
  const { state, setAspect, setCanvasSize } = useStore();
  const { aspect, size } = state.canvas;

  return (
    <div className="flex flex-col gap-3">
      <Select label="Aspect ratio" onChange={setAspect} options={ASPECT_OPTIONS} value={aspect} />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <FieldLabel>Width</FieldLabel>
          <TextInput
            min={1}
            onChange={(event) => setCanvasSize(Number(event.target.value), size.height)}
            type="number"
            value={size.width}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel>Height</FieldLabel>
          <TextInput
            min={1}
            onChange={(event) => setCanvasSize(size.width, Number(event.target.value))}
            type="number"
            value={size.height}
          />
        </label>
      </div>
    </div>
  );
}
