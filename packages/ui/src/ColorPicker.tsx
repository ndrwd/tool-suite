import * as React from "react";

/**
 * Custom color picker popover: saturation/value area, hue + alpha sliders, hex
 * field and eyedropper. Values are hex strings — `#RRGGBB`, or `#RRGGBBAA` when
 * alpha is below full.
 */

type Rgba = { r: number; g: number; b: number; a: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgba(hex: string): Rgba {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length === 6) h += "ff";
  if (h.length !== 8 || /[^0-9a-fA-F]/.test(h)) return { r: 0, g: 0, b: 0, a: 255 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: parseInt(h.slice(6, 8), 16),
  };
}

function rgbaToHex({ r, g, b, a }: Rgba): string {
  const to = (n: number): string => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  const base = `#${to(r)}${to(g)}${to(b)}`;
  return a >= 255 ? base : `${base}${to(a)}`;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g] = [c, x];
  else if (h < 120) [r, g] = [x, c];
  else if (h < 180) [g, b] = [c, x];
  else if (h < 240) [g, b] = [x, c];
  else if (h < 300) [r, b] = [x, c];
  else [r, b] = [c, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

function useDrag(onMove: (event: PointerEvent | React.PointerEvent) => void) {
  return React.useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      onMove(event);
      const handleMove = (moveEvent: PointerEvent): void => onMove(moveEvent);
      const handleUp = (): void => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [onMove],
  );
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [hue, setHue] = React.useState(() => rgbToHsv(hexToRgba(value).r, hexToRgba(value).g, hexToRgba(value).b).h);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const svRef = React.useRef<HTMLDivElement | null>(null);
  const hueRef = React.useRef<HTMLDivElement | null>(null);
  const alphaRef = React.useRef<HTMLDivElement | null>(null);

  const rgba = hexToRgba(value);
  const { s, v } = rgbToHsv(rgba.r, rgba.g, rgba.b);
  const solid = rgbaToHex({ ...rgba, a: 255 });

  React.useEffect(() => {
    if (!open) return;
    const handle = (event: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const commit = (nextHue: number, nextS: number, nextV: number, nextA: number): void => {
    const rgb = hsvToRgb(nextHue, nextS, nextV);
    onChange(rgbaToHex({ ...rgb, a: nextA }));
  };

  const onSv = useDrag((event) => {
    const rect = svRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ns = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const nv = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
    commit(hue, ns, nv, rgba.a);
  });

  const onHue = useDrag((event) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nh = clamp((event.clientX - rect.left) / rect.width, 0, 1) * 360;
    setHue(nh);
    commit(nh, s, v, rgba.a);
  });

  const onAlpha = useDrag((event) => {
    const rect = alphaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const na = Math.round(clamp((event.clientX - rect.left) / rect.width, 0, 1) * 255);
    commit(hue, s, v, na);
  });

  const eyeDropper = (globalThis as { EyeDropper?: EyeDropperCtor }).EyeDropper;

  return (
    <div className="relative flex" ref={rootRef}>
      <button
        aria-label="Pick color"
        className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-[var(--border)] p-0.5"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <span
          className="block h-full w-full rounded-[3px]"
          style={{ backgroundColor: value }}
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-9 z-50 w-56 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg">
          <div
            className="relative h-32 w-full cursor-crosshair rounded-md"
            onPointerDown={onSv}
            ref={svRef}
            style={{
              backgroundImage: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`,
            }}
          >
            <span
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
              style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, backgroundColor: solid }}
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            {eyeDropper ? (
              <button
                aria-label="Eyedropper"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                onClick={() => {
                  void new eyeDropper().open().then((result) => onChange(result.sRGBHex)).catch(() => undefined);
                }}
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="m2 22 1-1h3l9-9M3 21v-3l9-9m6.4-6.4a2.1 2.1 0 0 1 3 3L17 8l-4-4 1.4-1.4a2.1 2.1 0 0 1 3 0Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}

            <div className="flex flex-1 flex-col gap-2">
              <div
                className="relative h-3 cursor-pointer rounded-full"
                onPointerDown={onHue}
                ref={hueRef}
                style={{
                  backgroundImage: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
                }}
              >
                <span
                  className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                  style={{ left: `${(hue / 360) * 100}%`, backgroundColor: `hsl(${hue}, 100%, 50%)` }}
                />
              </div>

              <div
                className="relative h-3 cursor-pointer rounded-full"
                onPointerDown={onAlpha}
                ref={alphaRef}
                style={{
                  backgroundImage: `linear-gradient(to right, transparent, ${solid}), repeating-conic-gradient(#808080 0 25%, #c0c0c0 0 50%)`,
                  backgroundSize: "auto, 8px 8px",
                }}
              >
                <span
                  className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                  style={{ left: `${(rgba.a / 255) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="rounded border border-[var(--border)] px-1.5 py-1 text-2xs text-[var(--muted-foreground)]">Hex</span>
            <input
              className="w-full rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-1 font-mono text-xs uppercase text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              onChange={(event) => onChange(event.target.value.startsWith("#") ? event.target.value : `#${event.target.value}`)}
              value={value.replace("#", "")}
            />
            <span className="shrink-0 text-2xs tabular-nums text-[var(--muted-foreground)]">
              {Math.round((rgba.a / 255) * 100)}%
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
