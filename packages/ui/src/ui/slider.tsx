import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "../cn"

/**
 * Two fixes over the stock shadcn slider, both needed against @base-ui/react 1.6:
 *
 * 1. Base UI emits `data-orientation="horizontal|vertical"`, so the stock
 *    `data-horizontal:` / `data-vertical:` variants never match and the track
 *    renders at zero height. These use `data-[orientation=…]` instead.
 * 2. The stock thumb count falls back to `[min, max]` for a scalar `value`,
 *    which renders two thumbs stacked at the same spot. A scalar value is one
 *    thumb.
 *
 * Sizing is tuned for the suite's dense control panels — a 4px track and a
 * small round thumb, rather than the roomier form default. The filled part and
 * the thumb carry `--primary`.
 */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const _values =
    value !== undefined
      ? Array.isArray(value)
        ? value
        : [value]
      : defaultValue !== undefined
        ? Array.isArray(defaultValue)
          ? defaultValue
          : [defaultValue]
        : [min]

  return (
    <SliderPrimitive.Root
      className={cn(
        "group/slider data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full",
        className
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--foreground)_16%,transparent)] transition-colors select-none group-hover/slider:bg-[color-mix(in_oklab,var(--foreground)_28%,transparent)] data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="block size-3.5 shrink-0 rounded-full border-2 border-[var(--background)] bg-primary transition-[box-shadow,transform] select-none hover:shadow-[0_0_0_5px_color-mix(in_oklab,var(--primary)_24%,transparent)] focus-visible:shadow-[0_0_0_5px_color-mix(in_oklab,var(--primary)_32%,transparent)] focus-visible:outline-hidden active:scale-110 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
