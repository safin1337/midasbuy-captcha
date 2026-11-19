"use client"

import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import type { VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "./toggle"
import type { WithClassName } from "./_shared"

/*
 * Interior ToggleGroup - the segmented control: a well cut into the panel
 * (9px shell = 6px items + 3px padding) holding flat segments. The pressed
 * segment is the ink thumb the Toggle already defines - the same material as
 * the primary Button, so every "on" in the system reads as one thing.
 */

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({ size: "default", variant: "default" })

const ToggleGroup = React.forwardRef<
  HTMLDivElement,
  WithClassName<ToggleGroupPrimitive.Props> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive
    ref={ref}
    className={cn(
      "inline-flex items-center gap-0.5 rounded-[0.5625rem] p-[0.1875rem]",
      "border border-border bg-secondary shadow-[var(--shadow-well)]",
      className
    )}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>
      {children}
    </ToggleGroupContext.Provider>
  </ToggleGroupPrimitive>
))
ToggleGroup.displayName = "ToggleGroup"

const ToggleGroupItem = React.forwardRef<
  HTMLButtonElement,
  WithClassName<TogglePrimitive.Props> & VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)
  return (
    <TogglePrimitive
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant ?? variant,
          size: context.size ?? size,
        }),
        // Inside the well the item drops to the 6px inner radius and loses
        // the panel hover wash; the well is already the resting surface.
        "rounded-[0.375rem] hover:bg-transparent hover:text-foreground",
        "data-pressed:hover:bg-primary/90",
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
})
ToggleGroupItem.displayName = "ToggleGroupItem"

export { ToggleGroup, ToggleGroupItem }
