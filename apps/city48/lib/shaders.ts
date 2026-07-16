// Shader definitions inspired by the Paper Shaders project (paper-design/shaders).
// Each shader is a WebGL fragment shader that samples the uploaded media (u_texture)
// and applies a distinct visual effect controlled by a set of parameters.

export type ShaderParam = {
  key: string
  label: string
  min: number
  max: number
  step: number
  default: number
  // "toggle" renders as an on/off switch (value is 0 or 1). Defaults to "range".
  type?: "range" | "toggle" | "select"
  options?: { value: number; label: string }[]
}

// An RGB colour a shader exposes, kept apart from `params` because those are a
// flat map of floats bound with uniform1f. A colour needs a vec3, so it gets its
// own channel rather than being smuggled through as three unrelated sliders.
export type ShaderColor = {
  key: string
  label: string
  default: Rgb
}

/** Linear 0..1 RGB, matching the vec3 the fragment shader receives. */
export type Rgb = [number, number, number]

export type ShaderDef = {
  id: string
  name: string
  description: string
  fragment: string
  params: ShaderParam[]
  colors?: ShaderColor[]
}

// Helper to declare a boolean on/off parameter.
function toggle(key: string, label: string, on = false): ShaderParam {
  return { key, label, min: 0, max: 1, step: 1, default: on ? 1 : 0, type: "toggle" }
}

// Common "blend with original" control shared by most shaders.
function blend(def = 1): ShaderParam {
  return { key: "mix", label: "Blend", min: 0, max: 1, step: 0.02, default: def }
}

// Shared vertex shader — draws a full-screen quad and passes UV coordinates.
export const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const HEADER = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;
`

// High-quality film grain / hash — no cell-grid quantization.
const NOISE_FUNCS = `
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float filmGrain(vec2 frag, float grainSize, float frame) {
  vec2 p = frag / max(grainSize, 1.0);
  float g = 0.0;
  float amp = 0.55;
  float freq = 1.0;
  for (int i = 0; i < 4; i++) {
    g += (hash21(p * freq + frame) - 0.5) * amp;
    freq *= 2.1;
    amp *= 0.5;
  }
  g += (hash21(frag * 1.7 + frame * 13.7) - 0.5) * 0.12;
  return g;
}

vec3 filmGrainRgb(vec2 frag, float grainSize, float frame) {
  return vec3(
    filmGrain(frag, grainSize, frame),
    filmGrain(frag + 19.17, grainSize, frame + 7.3),
    filmGrain(frag + 47.83, grainSize, frame + 13.1)
  );
}
`

export const SHADERS: ShaderDef[] = [
  {
    id: "dither",
    name: "Dithering",
    description: "Ordered Bayer dithering with adjustable levels",
    params: [
      { key: "pixelSize", label: "Pixel Size", min: 1, max: 16, step: 1, default: 3 },
      { key: "levels", label: "Color Levels", min: 2, max: 8, step: 1, default: 3 },
      { key: "contrast", label: "Contrast", min: 0.5, max: 2.5, step: 0.05, default: 1.2 },
      { key: "brightness", label: "Brightness", min: -0.5, max: 0.5, step: 0.01, default: 0.0 },
      toggle("mono", "Monochrome"),
      blend(),
    ],
    fragment: `${HEADER}
uniform float u_pixelSize;
uniform float u_levels;
uniform float u_contrast;
uniform float u_brightness;
uniform float u_mono;
uniform float u_mix;

float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int index = x + y * 4;
  float m[16];
  m[0]=0.0;  m[1]=8.0;  m[2]=2.0;  m[3]=10.0;
  m[4]=12.0; m[5]=4.0;  m[6]=14.0; m[7]=6.0;
  m[8]=3.0;  m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0;m[13]=7.0; m[14]=13.0;m[15]=5.0;
  float v = 0.0;
  for (int i = 0; i < 16; i++) { if (i == index) v = m[i]; }
  return (v + 0.5) / 16.0;
}

void main() {
  vec2 px = u_pixelSize / u_resolution;
  vec2 uv = px * floor(v_uv / px);
  vec3 orig = texture2D(u_texture, v_uv).rgb;
  vec3 color = texture2D(u_texture, uv).rgb;
  if (u_mono > 0.5) {
    float l = dot(color, vec3(0.299, 0.587, 0.114));
    color = vec3(l);
  }
  color = (color - 0.5) * u_contrast + 0.5 + u_brightness;
  float threshold = bayer4(gl_FragCoord.xy / u_pixelSize);
  vec3 dithered = color + (threshold - 0.5) / u_levels;
  vec3 quantized = floor(dithered * (u_levels - 1.0) + 0.5) / (u_levels - 1.0);
  gl_FragColor = vec4(mix(orig, clamp(quantized, 0.0, 1.0), u_mix), 1.0);
}
`,
  },
  {
    id: "rgbShift",
    name: "RGB Shift",
    description: "Chromatic aberration that splits color channels",
    params: [
      { key: "amount", label: "Amount", min: 0, max: 0.05, step: 0.001, default: 0.012 },
      { key: "angle", label: "Angle", min: 0, max: 360, step: 1, default: 0 },
      { key: "falloff", label: "Edge Falloff", min: 0, max: 1, step: 0.02, default: 0.0 },
      toggle("animate", "Animate"),
      blend(),
    ],
    fragment: `${HEADER}
uniform float u_amount;
uniform float u_angle;
uniform float u_falloff;
uniform float u_animate;
uniform float u_mix;

void main() {
  float a = radians(u_angle) + u_animate * u_time * 0.6;
  // Optionally scale the shift by distance from center for a lens-like falloff.
  float radial = mix(1.0, length(v_uv - 0.5) * 2.0, u_falloff);
  vec2 dir = vec2(cos(a), sin(a)) * u_amount * radial;
  float r = texture2D(u_texture, v_uv + dir).r;
  float g = texture2D(u_texture, v_uv).g;
  float b = texture2D(u_texture, v_uv - dir).b;
  vec3 orig = texture2D(u_texture, v_uv).rgb;
  gl_FragColor = vec4(mix(orig, vec3(r, g, b), u_mix), 1.0);
}
`,
  },
  {
    id: "pixelate",
    name: "Pixelate",
    description: "Mosaic block pixelation",
    params: [
      { key: "size", label: "Block Size", min: 2, max: 80, step: 1, default: 16 },
      { key: "gap", label: "Gap", min: 0, max: 0.5, step: 0.01, default: 0.0 },
      { key: "smoothness", label: "Edge Softness", min: 0, max: 0.5, step: 0.01, default: 0.0 },
      toggle("round", "Round Pixels"),
    ],
    fragment: `${HEADER}
uniform float u_size;
uniform float u_gap;
uniform float u_smoothness;
uniform float u_round;

void main() {
  vec2 blocks = u_resolution / u_size;
  vec2 cell = floor(v_uv * blocks);
  vec2 uv = (cell + 0.5) / blocks;
  vec3 color = texture2D(u_texture, uv).rgb;
  vec2 f = fract(v_uv * blocks);
  float mask;
  if (u_round > 0.5) {
    // Circular dots: fade based on distance from cell center.
    float d = length(f - 0.5) * 2.0;
    float radius = 1.0 - u_gap;
    mask = smoothstep(radius + u_smoothness, radius - u_smoothness, d);
  } else {
    vec2 e = smoothstep(vec2(u_gap - u_smoothness), vec2(u_gap + u_smoothness), f)
           * smoothstep(vec2(u_gap - u_smoothness), vec2(u_gap + u_smoothness), 1.0 - f);
    mask = e.x * e.y;
  }
  gl_FragColor = vec4(color * mask, 1.0);
}
`,
  },
  {
    id: "crt",
    name: "CRT Scanlines",
    description: "Retro CRT scanlines with vignette and curvature",
    params: [
      { key: "scanCount", label: "Scanlines", min: 100, max: 1200, step: 10, default: 500 },
      { key: "intensity", label: "Intensity", min: 0, max: 1, step: 0.02, default: 0.4 },
      { key: "curvature", label: "Curvature", min: 0, max: 0.4, step: 0.01, default: 0.12 },
      { key: "vignette", label: "Vignette", min: 0, max: 1, step: 0.02, default: 0.5 },
      { key: "brightness", label: "Brightness", min: 0.5, max: 2, step: 0.02, default: 1.15 },
      { key: "flicker", label: "Flicker", min: 0, max: 0.5, step: 0.01, default: 0.0 },
      toggle("mask", "RGB Mask"),
    ],
    fragment: `${HEADER}
uniform float u_scanCount;
uniform float u_intensity;
uniform float u_curvature;
uniform float u_vignette;
uniform float u_brightness;
uniform float u_flicker;
uniform float u_mask;

vec2 curve(vec2 uv) {
  uv = uv * 2.0 - 1.0;
  vec2 offset = abs(uv.yx) * u_curvature;
  uv = uv + uv * offset * offset;
  return uv * 0.5 + 0.5;
}

void main() {
  vec2 uv = curve(v_uv);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec3 color = texture2D(u_texture, uv).rgb;
  float scan = sin(uv.y * u_scanCount) * 0.5 + 0.5;
  color *= 1.0 - u_intensity * (1.0 - scan);
  // Aperture-grille style RGB phosphor mask.
  if (u_mask > 0.5) {
    float m = mod(gl_FragCoord.x, 3.0);
    vec3 rgb = vec3(m < 1.0 ? 1.0 : 0.35, (m >= 1.0 && m < 2.0) ? 1.0 : 0.35, m >= 2.0 ? 1.0 : 0.35);
    color *= rgb;
  }
  color *= u_brightness;
  color *= 1.0 - u_flicker * (0.5 + 0.5 * sin(u_time * 40.0));
  vec2 vig = uv * (1.0 - uv.yx);
  float v = pow(vig.x * vig.y * 15.0, u_vignette);
  color *= clamp(v, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
`,
  },
  {
    id: "wave",
    name: "Wave Distortion",
    description: "Animated ripple / liquid warp",
    params: [
      { key: "amplitude", label: "Amplitude", min: 0, max: 0.1, step: 0.002, default: 0.02 },
      { key: "frequency", label: "Frequency", min: 1, max: 40, step: 1, default: 12 },
      { key: "speed", label: "Speed", min: 0, max: 4, step: 0.05, default: 1.0 },
      { key: "chroma", label: "Chromatic", min: 0, max: 0.02, step: 0.0005, default: 0.0 },
      toggle("radial", "Radial Ripple"),
    ],
    fragment: `${HEADER}
uniform float u_amplitude;
uniform float u_frequency;
uniform float u_speed;
uniform float u_chroma;
uniform float u_radial;

void main() {
  vec2 uv = v_uv;
  float t = u_time * u_speed;
  if (u_radial > 0.5) {
    // Concentric ripples emanating from the center.
    vec2 c = v_uv - 0.5;
    float d = length(c);
    float off = sin(d * u_frequency * 6.28 - t * 3.0) * u_amplitude;
    uv += normalize(c + 1e-5) * off;
  } else {
    uv.x += sin(uv.y * u_frequency + t) * u_amplitude;
    uv.y += cos(uv.x * u_frequency + t) * u_amplitude;
  }
  // Optional per-channel offset for a watery chromatic edge.
  float r = texture2D(u_texture, uv + vec2(u_chroma, 0.0)).r;
  float g = texture2D(u_texture, uv).g;
  float b = texture2D(u_texture, uv - vec2(u_chroma, 0.0)).b;
  gl_FragColor = vec4(r, g, b, 1.0);
}
`,
  },
  {
    id: "halftone",
    name: "Halftone",
    description: "Print-style halftone dot pattern",
    params: [
      { key: "scale", label: "Dot Scale", min: 40, max: 300, step: 2, default: 120 },
      { key: "angle", label: "Grid Angle", min: 0, max: 90, step: 1, default: 23 },
      { key: "smooth", label: "Softness", min: 0.0, max: 0.5, step: 0.01, default: 0.12 },
      { key: "contrast", label: "Contrast", min: 0.5, max: 2.5, step: 0.02, default: 1.0 },
      toggle("color", "Colored"),
      toggle("invert", "Invert"),
    ],
    fragment: `${HEADER}
uniform float u_scale;
uniform float u_angle;
uniform float u_smooth;
uniform float u_contrast;
uniform float u_color;
uniform float u_invert;

mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

float halftone(float value, vec2 coord) {
  value = clamp((value - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  vec2 g = rot(radians(u_angle)) * coord * u_scale;
  vec2 cell = fract(g) - 0.5;
  float d = length(cell);
  float radius = sqrt(1.0 - value) * 0.7;
  return smoothstep(radius + u_smooth, radius - u_smooth, d);
}

void main() {
  vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
  vec2 coord = v_uv * aspect;
  vec3 color = texture2D(u_texture, v_uv).rgb;
  vec3 result;
  if (u_color > 0.5) {
    float r = halftone(color.r, coord);
    float g = halftone(color.g, coord + 0.33);
    float b = halftone(color.b, coord + 0.66);
    result = vec3(r, g, b);
  } else {
    float l = dot(color, vec3(0.299, 0.587, 0.114));
    result = vec3(halftone(l, coord));
  }
  if (u_invert > 0.5) result = 1.0 - result;
  gl_FragColor = vec4(result, 1.0);
}
`,
  },
  {
    id: "kaleidoscope",
    name: "Kaleidoscope",
    description: "Mirrored radial symmetry",
    params: [
      { key: "segments", label: "Segments", min: 2, max: 24, step: 1, default: 6 },
      { key: "zoom", label: "Zoom", min: 0.3, max: 2.5, step: 0.02, default: 1.0 },
      { key: "spin", label: "Spin Speed", min: 0, max: 3, step: 0.02, default: 0.0 },
      { key: "offset", label: "Center Offset", min: 0, max: 0.5, step: 0.01, default: 0.0 },
      { key: "twist", label: "Twist", min: -3, max: 3, step: 0.05, default: 0.0 },
      toggle("animate", "Rotate"),
    ],
    fragment: `${HEADER}
uniform float u_segments;
uniform float u_zoom;
uniform float u_spin;
uniform float u_offset;
uniform float u_twist;
uniform float u_animate;

void main() {
  vec2 p = (v_uv - 0.5) * 2.0;
  p.x *= u_resolution.x / u_resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  a += u_animate * u_time * u_spin;
  a += r * u_twist; // swirl sampling based on radius
  float seg = 3.14159265 * 2.0 / u_segments;
  a = mod(a, seg);
  a = abs(a - seg * 0.5);
  vec2 uv = vec2(cos(a), sin(a)) * r / u_zoom;
  uv += u_offset;
  uv = fract(uv * 0.5 + 0.5);
  gl_FragColor = vec4(texture2D(u_texture, uv).rgb, 1.0);
}
`,
  },
  {
    id: "glitch",
    name: "Glitch",
    description: "Digital block displacement and color tearing",
    params: [
      { key: "intensity", label: "Intensity", min: 0, max: 1, step: 0.02, default: 0.4 },
      { key: "blockSize", label: "Block Size", min: 4, max: 60, step: 1, default: 20 },
      { key: "speed", label: "Speed", min: 0, max: 6, step: 0.1, default: 2.0 },
      { key: "colorShift", label: "Color Tear", min: 0, max: 0.1, step: 0.002, default: 0.02 },
      toggle("vertical", "Vertical"),
    ],
    fragment: `${HEADER}
uniform float u_intensity;
uniform float u_blockSize;
uniform float u_speed;
uniform float u_colorShift;
uniform float u_vertical;

float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  float t = floor(u_time * u_speed);
  vec2 block = floor(v_uv * u_blockSize);
  float noise = rand(block + t);
  float active = step(1.0 - u_intensity, noise);
  float axisKey = u_vertical > 0.5 ? block.x : block.y;
  float shift = (rand(vec2(axisKey, t)) - 0.5) * 0.2 * u_intensity * active;
  vec2 uv = u_vertical > 0.5
    ? vec2(v_uv.x, fract(v_uv.y + shift))
    : vec2(fract(v_uv.x + shift), v_uv.y);
  float ca = u_colorShift * u_intensity * active;
  float r = texture2D(u_texture, uv + vec2(ca, 0.0)).r;
  float g = texture2D(u_texture, uv).g;
  float b = texture2D(u_texture, uv - vec2(ca, 0.0)).b;
  gl_FragColor = vec4(r, g, b, 1.0);
}
`,
  },
  {
    id: "edge",
    name: "Edge Detection",
    description: "Sobel outline extraction",
    params: [
      { key: "strength", label: "Strength", min: 0.2, max: 4.0, step: 0.05, default: 1.5 },
      { key: "thickness", label: "Thickness", min: 0.5, max: 4.0, step: 0.1, default: 1.0 },
      { key: "bgMix", label: "Show Original", min: 0, max: 1, step: 0.02, default: 0.0 },
      toggle("colorEdges", "Color Edges"),
      toggle("invert", "Invert"),
    ],
    fragment: `${HEADER}
uniform float u_strength;
uniform float u_thickness;
uniform float u_bgMix;
uniform float u_colorEdges;
uniform float u_invert;

float lum(vec2 uv) {
  vec3 c = texture2D(u_texture, uv).rgb;
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec2 px = u_thickness / u_resolution;
  float tl = lum(v_uv + px * vec2(-1.0,  1.0));
  float t  = lum(v_uv + px * vec2( 0.0,  1.0));
  float tr = lum(v_uv + px * vec2( 1.0,  1.0));
  float l  = lum(v_uv + px * vec2(-1.0,  0.0));
  float rr = lum(v_uv + px * vec2( 1.0,  0.0));
  float bl = lum(v_uv + px * vec2(-1.0, -1.0));
  float b  = lum(v_uv + px * vec2( 0.0, -1.0));
  float br = lum(v_uv + px * vec2( 1.0, -1.0));
  float gx = -tl - 2.0*l - bl + tr + 2.0*rr + br;
  float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
  float g = clamp(sqrt(gx*gx + gy*gy) * u_strength, 0.0, 1.0);
  if (u_invert > 0.5) g = 1.0 - g;
  vec3 orig = texture2D(u_texture, v_uv).rgb;
  vec3 edges = u_colorEdges > 0.5 ? orig * g : vec3(g);
  gl_FragColor = vec4(mix(edges, orig, u_bgMix), 1.0);
}
`,
  },
  {
    id: "posterize",
    name: "Posterize",
    description: "Reduce colors to flat poster-like bands",
    params: [
      { key: "levels", label: "Levels", min: 2, max: 16, step: 1, default: 5 },
      { key: "saturation", label: "Saturation", min: 0, max: 2, step: 0.02, default: 1.2 },
      { key: "gamma", label: "Gamma", min: 0.4, max: 2.5, step: 0.02, default: 1.0 },
      { key: "brightness", label: "Brightness", min: -0.5, max: 0.5, step: 0.01, default: 0.0 },
      { key: "outline", label: "Outline", min: 0, max: 1, step: 0.02, default: 0.0 },
    ],
    fragment: `${HEADER}
uniform float u_levels;
uniform float u_saturation;
uniform float u_gamma;
uniform float u_brightness;
uniform float u_outline;

float lum2(vec2 uv) {
  vec3 c = texture2D(u_texture, uv).rgb;
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec3 color = texture2D(u_texture, v_uv).rgb;
  color = pow(color, vec3(u_gamma));
  float l = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(l), color, u_saturation);
  color = floor(color * u_levels) / (u_levels - 1.0);
  color += u_brightness;
  // Optional dark ink outline around color regions (cel-shading look).
  if (u_outline > 0.0) {
    vec2 px = 1.0 / u_resolution;
    float e = abs(lum2(v_uv + vec2(px.x, 0.0)) - lum2(v_uv - vec2(px.x, 0.0)))
            + abs(lum2(v_uv + vec2(0.0, px.y)) - lum2(v_uv - vec2(0.0, px.y)));
    color *= 1.0 - clamp(e * 6.0, 0.0, 1.0) * u_outline;
  }
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`,
  },
  {
    id: "vhs",
    name: "VHS",
    description: "Analog tape wobble, noise and color bleed",
    params: [
      { key: "wobble", label: "Wobble", min: 0, max: 0.02, step: 0.0005, default: 0.005 },
      { key: "noise", label: "Noise", min: 0, max: 1, step: 0.02, default: 0.25 },
      { key: "bleed", label: "Color Bleed", min: 0, max: 0.03, step: 0.001, default: 0.008 },
      { key: "speed", label: "Speed", min: 0, max: 4, step: 0.05, default: 1.0 },
      { key: "desaturate", label: "Desaturate", min: 0, max: 1, step: 0.02, default: 0.2 },
      { key: "vignette", label: "Vignette", min: 0, max: 1, step: 0.02, default: 0.3 },
      toggle("tracking", "Tracking Bar"),
    ],
    fragment: `${HEADER}
${NOISE_FUNCS}
uniform float u_wobble;
uniform float u_noise;
uniform float u_bleed;
uniform float u_speed;
uniform float u_desaturate;
uniform float u_vignette;
uniform float u_tracking;

float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  float t = u_time * u_speed;
  float line = v_uv.y * u_resolution.y;
  float wob = sin(v_uv.y * 80.0 + t * 6.0) * u_wobble
            + (rand(vec2(floor(line * 0.5), floor(t * 10.0))) - 0.5) * u_wobble * 2.0;
  // A scrolling tracking distortion band.
  if (u_tracking > 0.5) {
    float band = fract(v_uv.y + t * 0.15);
    float hit = smoothstep(0.96, 1.0, band);
    wob += hit * 0.04 * sin(v_uv.y * 200.0);
  }
  vec2 uv = vec2(v_uv.x + wob, v_uv.y);
  float r = texture2D(u_texture, uv + vec2(u_bleed, 0.0)).r;
  float g = texture2D(u_texture, uv).g;
  float b = texture2D(u_texture, uv - vec2(u_bleed, 0.0)).b;
  vec3 color = vec3(r, g, b);
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(color, vec3(lum), u_desaturate);
  float n = filmGrain(gl_FragCoord.xy, 1.2, floor(t * 24.0));
  color += n * u_noise;
  float scan = 0.9 + 0.1 * sin(v_uv.y * u_resolution.y * 1.5);
  color *= scan;
  vec2 vig = v_uv * (1.0 - v_uv.yx);
  color *= mix(1.0, clamp(pow(vig.x * vig.y * 15.0, 0.4), 0.0, 1.0), u_vignette);
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`,
  },
  {
    id: "bloom",
    name: "Bloom",
    description: "Soft glow that blooms from bright areas",
    params: [
      { key: "threshold", label: "Threshold", min: 0, max: 1, step: 0.02, default: 0.6 },
      { key: "intensity", label: "Intensity", min: 0, max: 3, step: 0.05, default: 1.2 },
      { key: "radius", label: "Radius", min: 1, max: 8, step: 0.1, default: 3.0 },
      { key: "saturation", label: "Glow Saturation", min: 0, max: 2, step: 0.02, default: 1.0 },
      { key: "exposure", label: "Exposure", min: 0.5, max: 2, step: 0.02, default: 1.0 },
    ],
    fragment: `${HEADER}
uniform float u_threshold;
uniform float u_intensity;
uniform float u_radius;
uniform float u_saturation;
uniform float u_exposure;

vec3 sampleBright(vec2 uv) {
  vec3 c = texture2D(u_texture, uv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return c * smoothstep(u_threshold, 1.0, l);
}

vec3 blurBright(vec2 uv, float radiusPx) {
  vec2 stepPx = vec2(radiusPx / 6.0) / u_resolution;
  vec3 acc = vec3(0.0);
  float weightSum = 0.0;
  for (int i = -6; i <= 6; i++) {
    float fi = float(i);
    float w = exp(-0.5 * fi * fi / 12.0);
    acc += sampleBright(uv + vec2(fi, 0.0) * stepPx) * w;
    acc += sampleBright(uv + vec2(0.0, fi) * stepPx) * w;
    weightSum += w * 2.0;
  }
  return acc / weightSum;
}

void main() {
  vec3 base = texture2D(u_texture, v_uv).rgb;
  vec3 bloom = blurBright(v_uv, u_radius * 8.0);
  float bl = dot(bloom, vec3(0.299, 0.587, 0.114));
  bloom = mix(vec3(bl), bloom, u_saturation);
  vec3 color = (base + bloom * u_intensity) * u_exposure;
  gl_FragColor = vec4(color, 1.0);
}
`,
  },
  {
    id: "grayscale",
    name: "Duotone",
    description: "Map luminance between two tones",
    params: [
      { key: "hueA", label: "Shadow Hue", min: 0, max: 1, step: 0.005, default: 0.62 },
      { key: "hueB", label: "Highlight Hue", min: 0, max: 1, step: 0.005, default: 0.08 },
      { key: "contrast", label: "Contrast", min: 0.5, max: 2.5, step: 0.02, default: 1.2 },
      { key: "satA", label: "Shadow Saturation", min: 0, max: 1, step: 0.02, default: 0.6 },
      { key: "satB", label: "Highlight Saturation", min: 0, max: 1, step: 0.02, default: 0.7 },
      { key: "mix", label: "Blend", min: 0, max: 1, step: 0.02, default: 1.0 },
      toggle("swap", "Swap Tones"),
    ],
    fragment: `${HEADER}
uniform float u_hueA;
uniform float u_hueB;
uniform float u_contrast;
uniform float u_satA;
uniform float u_satB;
uniform float u_mix;
uniform float u_swap;

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec3 color = texture2D(u_texture, v_uv).rgb;
  float l = dot(color, vec3(0.299, 0.587, 0.114));
  l = clamp((l - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  vec3 a = hsv2rgb(vec3(u_hueA, u_satA, 0.25));
  vec3 b = hsv2rgb(vec3(u_hueB, u_satB, 1.0));
  if (u_swap > 0.5) { vec3 tmp = a; a = b; b = tmp; }
  vec3 duo = mix(a, b, l);
  gl_FragColor = vec4(mix(color, duo, u_mix), 1.0);
}
`,
  },
  {
    id: "highContrast",
    name: "High Contrast",
    description: "Punchy contrast, saturation and brightness grading",
    params: [
      { key: "contrast", label: "Contrast", min: 0.5, max: 3.0, step: 0.05, default: 1.6 },
      { key: "brightness", label: "Brightness", min: -0.5, max: 0.5, step: 0.01, default: 0.0 },
      { key: "saturation", label: "Saturation", min: 0.0, max: 2.5, step: 0.05, default: 1.2 },
      { key: "pivot", label: "Pivot", min: 0.2, max: 0.8, step: 0.01, default: 0.5 },
      toggle("crush", "Black Crush"),
      blend(),
    ],
    fragment: `${HEADER}
uniform float u_contrast;
uniform float u_brightness;
uniform float u_saturation;
uniform float u_pivot;
uniform float u_crush;
uniform float u_mix;

void main() {
  vec3 color = texture2D(u_texture, v_uv).rgb;
  vec3 graded = (color - u_pivot) * u_contrast + u_pivot + u_brightness;
  float l = dot(graded, vec3(0.299, 0.587, 0.114));
  graded = mix(vec3(l), graded, u_saturation);
  if (u_crush > 0.5) graded = graded * graded * (3.0 - 2.0 * graded);
  graded = clamp(graded, 0.0, 1.0);
  gl_FragColor = vec4(mix(color, graded, u_mix), 1.0);
}
`,
  },
  {
    id: "progressiveBlur",
    name: "Progressive Blur",
    description: "Directional gradient blur that ramps across the frame",
    params: [
      { key: "maxBlur", label: "Max Blur", min: 0.0, max: 100.0, step: 0.01, default: 1.3 },
      { key: "gradientStart", label: "Gradient Start", min: 0.0, max: 1.0, step: 0.01, default: 0.32 },
      { key: "gradientEnd", label: "Gradient End", min: 0.0, max: 1.0, step: 0.01, default: 0.75 },
      {
        key: "axis",
        label: "Axis",
        min: 0,
        max: 1,
        step: 1,
        default: 1,
        type: "select",
        options: [
          { value: 0, label: "Horizontal (X)" },
          { value: 1, label: "Vertical (Y)" },
        ],
      },
      { key: "angle", label: "Angle", min: 0.0, max: 360.0, step: 1.0, default: 0.0 },
      { key: "softness", label: "Softness", min: 0.0, max: 1.0, step: 0.01, default: 0.0 },
      { key: "arc", label: "Arc", min: 0.0, max: 1.0, step: 0.01, default: 0.0 },
      { key: "motion", label: "Motion", min: 0.0, max: 1.0, step: 0.01, default: 0.0 },
      { key: "motionAngle", label: "Motion Angle", min: 0.0, max: 360.0, step: 1.0, default: 0.0 },
    ],
    fragment: `${HEADER}
uniform float u_maxBlur;
uniform float u_gradientStart;
uniform float u_gradientEnd;
uniform float u_axis;
uniform float u_angle;
uniform float u_softness;
uniform float u_arc;
uniform float u_motion;
uniform float u_motionAngle;

uniform float u_pass;

vec3 blurPass(vec2 uv, float radiusPx) {
  // Two separable passes along a rotatable pair of axes. Motion shrinks the
  // second, across-axis pass: at 0 the two are equal and the blur is a round
  // defocus, at 1 only the first survives and it reads as a directional smear.
  float a = radians(u_motionAngle);
  vec2 dir = vec2(cos(a), sin(a));
  vec2 axis = u_pass < 0.5 ? dir : vec2(-dir.y, dir.x);
  float r = u_pass < 0.5 ? radiusPx : radiusPx * (1.0 - u_motion);

  if (r < 0.5) return texture2D(u_texture, uv).rgb;

  vec2 stepPx = axis * (r / 8.0) / u_resolution;
  vec3 acc = vec3(0.0);
  float weightSum = 0.0;

  for (int i = -8; i <= 8; i++) {
    float fi = float(i);
    float w = exp(-0.5 * fi * fi / 16.0);
    acc += texture2D(u_texture, uv + fi * stepPx).rgb * w;
    weightSum += w;
  }

  return acc / weightSum;
}

void main() {
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = v_uv - 0.5;
  p.x *= aspect;

  vec2 axisDir = u_axis < 0.5 ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  float a = radians(u_angle);
  float c = cos(a);
  float s = sin(a);
  axisDir = vec2(axisDir.x * c - axisDir.y * s, axisDir.x * s + axisDir.y * c);

  float t = dot(p, axisDir) + 0.5;
  if (u_arc > 0.001) {
    float radial = clamp(length(p) / 0.70710678, 0.0, 1.0);
    t = mix(t, radial, clamp(u_arc, 0.0, 1.0));
  }

  float range = max(u_gradientEnd - u_gradientStart, 0.001);
  float pad = u_softness * range * 0.5;
  float blurAmt = smoothstep(u_gradientStart - pad, u_gradientEnd + pad, t);

  float pixelRadius = blurAmt * u_maxBlur;
  vec3 blurred = blurPass(v_uv, pixelRadius);
  gl_FragColor = vec4(blurred, 1.0);
}
`,
  },
  {
    id: "grain",
    name: "Grain",
    description: "Animated film grain with luminance-aware noise",
    params: [
      { key: "amount", label: "Amount", min: 0.0, max: 1.0, step: 0.01, default: 0.35 },
      { key: "size", label: "Grain Size", min: 0.5, max: 4.0, step: 0.05, default: 1.0 },
      { key: "shadows", label: "Shadow Boost", min: 0.0, max: 2.0, step: 0.05, default: 1.0 },
      toggle("mono", "Monochrome", true),
      toggle("animate", "Animate", true),
      blend(),
    ],
    fragment: `${HEADER}
${NOISE_FUNCS}
uniform float u_amount;
uniform float u_size;
uniform float u_shadows;
uniform float u_mono;
uniform float u_animate;
uniform float u_mix;

void main() {
  vec3 color = texture2D(u_texture, v_uv).rgb;
  float seed = u_animate > 0.5 ? floor(u_time * 24.0) : 0.0;

  vec3 noise;
  if (u_mono > 0.5) {
    float n = filmGrain(gl_FragCoord.xy, u_size, seed);
    noise = vec3(n);
  } else {
    noise = filmGrainRgb(gl_FragCoord.xy, u_size, seed);
  }

  float l = dot(color, vec3(0.299, 0.587, 0.114));
  float weight = mix(1.0, 1.0 + (1.0 - l) * u_shadows, 1.0);
  vec3 grained = clamp(color + noise * u_amount * weight, 0.0, 1.0);
  gl_FragColor = vec4(mix(color, grained, u_mix), 1.0);
}
`,
  },
  {
    id: "spiralHalftone",
    name: "Spiral Halftone",
    description: "Halftone dots arranged along a rotating spiral",
    params: [
      { key: "scale", label: "Dot Scale", min: 4.0, max: 60.0, step: 1.0, default: 24.0 },
      { key: "twist", label: "Twist", min: 0.0, max: 20.0, step: 0.1, default: 6.0 },
      { key: "contrast", label: "Contrast", min: 0.5, max: 3.0, step: 0.05, default: 1.3 },
      { key: "spin", label: "Spin Speed", min: -3.0, max: 3.0, step: 0.05, default: 0.4 },
      toggle("colored", "Colored"),
      blend(),
    ],
    fragment: `${HEADER}
uniform float u_scale;
uniform float u_twist;
uniform float u_contrast;
uniform float u_spin;
uniform float u_colored;
uniform float u_mix;

void main() {
  vec3 color = texture2D(u_texture, v_uv).rgb;
  float aspect = u_resolution.x / u_resolution.y;

  // Polar coordinates around the center, aspect corrected.
  vec2 p = v_uv - 0.5;
  p.x *= aspect;
  float r = length(p);
  float a = atan(p.y, p.x) + u_time * u_spin;

  // Warp the sampling grid into a spiral, then build a dot lattice.
  vec2 spiral = vec2(a * u_twist + r * u_scale, r * u_scale);
  vec2 cell = fract(spiral) - 0.5;
  float dist = length(cell) * 2.0;

  float lum = clamp((dot(color, vec3(0.299, 0.587, 0.114)) - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  float dotMask = smoothstep(lum + 0.05, lum - 0.05, dist);

  vec3 result = u_colored > 0.5 ? color * dotMask : vec3(dotMask);
  gl_FragColor = vec4(mix(color, result, u_mix), 1.0);
}
`,
  },
  {
    id: "grainyBright",
    name: "Grainy Bright Colours",
    description: "Vivid saturated grade with punchy chromatic grain",
    params: [
      { key: "saturation", label: "Saturation", min: 1.0, max: 3.0, step: 0.05, default: 1.8 },
      { key: "vibrance", label: "Vibrance", min: 0.0, max: 2.0, step: 0.05, default: 1.0 },
      { key: "brightness", label: "Brightness", min: 0.0, max: 0.6, step: 0.01, default: 0.15 },
      { key: "grain", label: "Grain", min: 0.0, max: 1.0, step: 0.01, default: 0.4 },
      { key: "grainSize", label: "Grain Size", min: 0.5, max: 4.0, step: 0.05, default: 1.5 },
      toggle("animate", "Animate", true),
      blend(),
    ],
    fragment: `${HEADER}
${NOISE_FUNCS}
uniform float u_saturation;
uniform float u_vibrance;
uniform float u_brightness;
uniform float u_grain;
uniform float u_grainSize;
uniform float u_animate;
uniform float u_mix;

void main() {
  vec3 color = texture2D(u_texture, v_uv).rgb;
  vec3 c = color + u_brightness;

  float l = dot(c, vec3(0.299, 0.587, 0.114));
  // Base saturation lift.
  c = mix(vec3(l), c, u_saturation);
  // Vibrance protects already-saturated pixels, boosts muted ones.
  float sat = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
  c = mix(vec3(l), c, 1.0 + u_vibrance * (1.0 - sat));

  float seed = u_animate > 0.5 ? floor(u_time * 24.0) : 0.0;
  vec3 noise = filmGrainRgb(gl_FragCoord.xy, u_grainSize, seed);
  c += noise * u_grain;

  c = clamp(c, 0.0, 1.0);
  gl_FragColor = vec4(mix(color, c, u_mix), 1.0);
}
`,
  },
  {
    id: "wavyLines",
    name: "Wavy Lines",
    description: "Line halftone whose stripes ripple and thicken with luminance",
    params: [
      { key: "frequency", label: "Frequency", min: 1.0, max: 20.0, step: 0.05, default: 6.5 },
      { key: "thickness", label: "Thickness", min: 0.0, max: 1.0, step: 0.01, default: 0.82 },
      { key: "waveAmplitude", label: "Wave Amplitude", min: 0.0, max: 100.0, step: 1.0, default: 38.0 },
      { key: "waveFrequency", label: "Wave Frequency", min: 0.0, max: 5.0, step: 0.01, default: 0.6 },
      { key: "edgeSmoothing", label: "Edge Smoothing", min: 0.0, max: 1.0, step: 0.01, default: 0.33 },
      { key: "rotation", label: "Rotation", min: 0.0, max: 360.0, step: 0.5, default: 202.0 },
      { key: "centerX", label: "Center X", min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      { key: "centerY", label: "Center Y", min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      blend(),
    ],
    colors: [
      { key: "baseColor", label: "Base Color", default: [0.243, 0.231, 0.431] },
      { key: "lineColor", label: "Line Color", default: [0.725, 0.769, 0.678] },
    ],
    fragment: `${HEADER}
uniform float u_frequency;
uniform float u_thickness;
uniform float u_waveAmplitude;
uniform float u_waveFrequency;
uniform float u_edgeSmoothing;
uniform float u_rotation;
uniform float u_centerX;
uniform float u_centerY;
uniform vec3 u_baseColor;
uniform vec3 u_lineColor;
uniform float u_mix;

void main() {
  vec3 color = texture2D(u_texture, v_uv).rgb;

  // Work in pixels around the chosen centre, so rotation stays circular and the
  // wave amplitude reads in pixels the way its slider is labelled.
  vec2 p = (v_uv - vec2(u_centerX, u_centerY)) * u_resolution;

  float a = radians(u_rotation);
  vec2 dir = vec2(cos(a), sin(a));
  vec2 rotated = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));

  // Ripple the stripe coordinate along the band, then fold it into a triangle
  // wave so every stripe has a symmetric profile to threshold against.
  float ripple = sin(rotated.x * u_waveFrequency * 0.01) * u_waveAmplitude;
  float band = (rotated.y + ripple) * u_frequency * 0.01;
  float tri = abs(fract(band) - 0.5) * 2.0;

  // Brighter pixels grow the stripe, so the image reads as ink coverage on a
  // plate: highlights fill with line colour, shadows keep the base showing
  // through. Two flat tones only — the photo drives coverage, not hue.
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  float width = clamp(lum * u_thickness, 0.0, 1.0);

  // Quarter-scale the slider: at full width the ramp spans most of a stripe and
  // smears faint lines across areas that should stay clear.
  float edge = max(u_edgeSmoothing * 0.25, 0.002);
  float line = smoothstep(width + edge, width - edge, tri);

  vec3 result = mix(u_baseColor, u_lineColor, line);
  gl_FragColor = vec4(mix(color, result, u_mix), 1.0);
}
`,
  }
]

export function getShader(id: string): ShaderDef {
  return SHADERS.find((s) => s.id === id) ?? SHADERS[0]
}

export function defaultParams(shader: ShaderDef): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of shader.params) out[p.key] = p.default
  return out
}

export function defaultColors(shader: ShaderDef): Record<string, Rgb> {
  const out: Record<string, Rgb> = {}
  for (const c of shader.colors ?? []) out[c.key] = [...c.default]
  return out
}

// A single effect in the shader stack. Enabled layers are applied in order.
export type ShaderLayer = {
  uid: string
  shaderId: string
  params: Record<string, number>
  colors: Record<string, Rgb>
  enabled: boolean
}

export function createLayer(shaderId: string): ShaderLayer {
  const shader = getShader(shaderId)
  return {
    uid: Math.random().toString(36).slice(2, 10),
    shaderId: shader.id,
    params: defaultParams(shader),
    colors: defaultColors(shader),
    enabled: true,
  }
}
