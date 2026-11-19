import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"

import { cn } from "@/lib/utils"
import type { WithClassName } from "./_shared"

/*
 * Interior RadioGroup - circles are banned, so a radio is a 5px-radius cell
 * like the checkbox, told apart by its indicator: a small 1.5px-radius ink
 * dot seated in the cell, not a tick. Checked, the cell stays a well and the
 * dot carries the primary Button's ink fill and thumb shadow - the selected
 * state is ink and depth, never blue.
 */

const RadioGroup = React.forwardRef<
  HTMLDivElement,
  WithClassName<RadioGroupPrimitive.Props>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive
    data-slot="radio-group"
    ref={ref}
    className={cn("grid gap-2.5", className)}
    {...props}
  />
))
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<
  HTMLButtonElement,
  WithClassName<RadioPrimitive.Root.Props>
>(({ className, ...props }, ref) => (
  <RadioPrimitive.Root
    data-slot="radio-group-item"
    ref={ref}
    className={cn(
      "flex size-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem]",
      "border-2 border-border bg-input",
      "shadow-[var(--shadow-well)]",
      "transition-[background-color,border-color,box-shadow] duration-fast",
      "focus-visible:outline-none focus-visible:border-ring focus-visible:bg-card focus-visible:shadow-none",
      "data-disabled:cursor-not-allowed data-disabled:opacity-50",
      "data-checked:border-primary/20 data-checked:bg-card data-checked:shadow-none",
      className
    )}
    {...props}
  >
    <RadioPrimitive.Indicator data-slot="radio-group-indicator" className="size-full flex items-center justify-center">
      <span className="block size-2 rounded-[0.0938rem] bg-primary shadow-[var(--shadow-thumb)]" />
    </RadioPrimitive.Indicator>
  </RadioPrimitive.Root>
))
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
