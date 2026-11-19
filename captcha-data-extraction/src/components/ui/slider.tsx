import * as React from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

/*
 * Interior Slider - a 4px-radius track cut into the panel as a well, a
 * 2px-radius ink fill, and a cap for a thumb: the same flat ink fill and
 * thumb shadow as the primary Button. A meter should not spring past the
 * number it is reporting, so nothing here overshoots.
 */

const Slider = React.forwardRef<HTMLDivElement, SliderPrimitive.Root.Props>(
  ({ className, defaultValue, value, min = 0, max = 100, ...props }, ref) => {
    const _values = Array.isArray(value)
      ? value
      : Array.isArray(defaultValue)
        ? defaultValue
        : [min, max]

    return (
      <SliderPrimitive.Root
        data-slot="slider"
        ref={ref}
        thumbAlignment="edge"
        defaultValue={defaultValue}
        value={value}
        min={min}
        max={max}
        className={cn("relative w-full", className)}
        {...props}
      >
        <SliderPrimitive.Control className="flex w-full touch-none select-none items-center">
          <SliderPrimitive.Track data-slot="slider-track" className="relative h-[0.375rem] w-full grow overflow-hidden rounded-[0.25rem] bg-secondary shadow-[var(--shadow-well)]">
            <SliderPrimitive.Indicator data-slot="slider-range" className="absolute h-full rounded-[0.125rem] bg-primary" />
          </SliderPrimitive.Track>
          {Array.from({ length: _values.length }, (_, index) => (
            <SliderPrimitive.Thumb
              data-slot="slider-thumb" key={index}
              className={cn(
                "block h-[1.125rem] w-[0.625rem] rounded-[0.25rem] bg-primary",
                "shadow-[var(--shadow-thumb)]",
                "transition-[box-shadow] duration-fast",
                "focus-visible:outline-none focus-visible:shadow-[var(--shadow-thumb),0_0_0_0.0938rem_var(--ring-inverted)]",
                "data-disabled:pointer-events-none data-disabled:opacity-50"
              )}
            />
          ))}
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
