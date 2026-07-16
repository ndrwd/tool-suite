import { createLayer, defaultColors, defaultParams, getShader, type Rgb, type ShaderLayer } from "./shaders"

// A preset is a named shader stack. Params listed here override the shader's
// defaults; anything omitted keeps its default, so a preset only has to state
// what makes it distinctive.
//
// Values must land on the param's own step grid. A slider snaps the thumb to
// its step but the readout prints the raw number, so an off-grid preset shows
// a thumb and a value that disagree, and jumps the moment it is dragged.
export type Preset = {
  id: string
  name: string
  layers: { shaderId: string; params?: Record<string, number>; colors?: Record<string, Rgb> }[]
}

export const PRESETS: Preset[] = [
  {
    id: "dynamic",
    name: "Dynamic",
    layers: [
      { shaderId: "highContrast", params: { contrast: 1.4 } },
      {
        shaderId: "progressiveBlur",
        // Max Blur is a pixel radius here, not the 0..1 the reference panel
        // used. Below 0.5 the blur pass is skipped outright, so the reference's
        // 0.80 read as "off" rather than as a strong blur.
        //
        // The gradient runs along +v_uv.y, which points up, so a bare Vertical
        // axis blurs the sky. Half a turn aims it at the foreground instead.
        params: {
          maxBlur: 20,
          gradientStart: 0.14,
          gradientEnd: 1.0,
          axis: 1,
          angle: 180,
          softness: 0,
          arc: 0,
          motion: 0.9,
          motionAngle: 0,
        },
      },
      { shaderId: "grain", params: { amount: 0.15 } },
    ],
  },
  {
    id: "wavy",
    name: "Wavy",
    layers: [
      { shaderId: "highContrast", params: { contrast: 1.6 } },
      {
        shaderId: "wavyLines",
        params: {
          frequency: 6.5,
          thickness: 0.82,
          waveAmplitude: 38,
          waveFrequency: 0.6,
          edgeSmoothing: 0.33,
          rotation: 202,
        },
        colors: { baseColor: [0.243, 0.231, 0.431], lineColor: [0.725, 0.769, 0.678] },
      },
      // Grain only: the two tones come from wavyLines, so saturation and
      // brightness stay neutral rather than blowing the plate out.
      { shaderId: "grainyBright", params: { saturation: 1.0, vibrance: 0, brightness: 0, grain: 0.25 } },
    ],
  },
]

/**
 * No preset. Not a member of PRESETS — it is the absence of one, and the state
 * the app opens in. Picking it only detaches the label; it never touches the
 * stack, which is the Reset action's job. It is also what the picker falls back
 * to once a preset has been edited into something of its own.
 */
export const MANUAL_PRESET = "manual"

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id)
}

/** The modules a preset stacks, in order — "High Contrast · Grain · …". */
export function presetModules(preset: Preset): string {
  return preset.layers.map((entry) => getShader(entry.shaderId).name).join(" · ")
}

/** Build a fresh, editable layer stack from a preset. */
export function presetLayers(preset: Preset): ShaderLayer[] {
  return preset.layers.map((entry) => {
    const layer = createLayer(entry.shaderId)
    return {
      ...layer,
      params: { ...layer.params, ...entry.params },
      colors: { ...layer.colors, ...entry.colors },
    }
  })
}

/**
 * Which preset the current stack corresponds to, or null once it has been
 * edited. Derived rather than remembered, so tweaking any slider drops the
 * label back to Manual on its own and it can never claim a stale preset.
 */
export function matchPreset(layers: ShaderLayer[]): Preset | null {
  return (
    PRESETS.find((preset) => {
      if (preset.layers.length !== layers.length) return false
      return preset.layers.every((entry, i) => {
        const layer = layers[i]
        if (!layer.enabled || layer.shaderId !== entry.shaderId) return false
        const shader = getShader(entry.shaderId)
        const expected = { ...defaultParams(shader), ...entry.params }
        if (!Object.entries(expected).every(([key, value]) => layer.params[key] === value)) return false

        const expectedColors = { ...defaultColors(shader), ...entry.colors }
        return Object.entries(expectedColors).every(([key, value]) =>
          value.every((channel, c) => layer.colors[key]?.[c] === channel),
        )
      })
    }) ?? null
  )
}
