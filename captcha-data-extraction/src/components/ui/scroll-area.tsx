"use client"

import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"

import { cn } from "@/lib/utils"
import type { WithClassName } from "./_shared"

/*
 * Interior ScrollArea - the scrollbar is metadata, not furniture: a 3px ink
 * thumb at 15% on a transparent track, squared off to the 2px rail radius.
 */

const ScrollBar = React.forwardRef<
  HTMLDivElement,
  WithClassName<ScrollAreaPrimitive.Scrollbar.Props>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.Scrollbar
    data-slot="scroll-area-scrollbar"
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none bg-transparent p-[0.125rem]",
      orientation === "vertical" ? "h-full w-[0.4375rem]" : "h-[0.4375rem] w-full flex-col",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.Thumb data-slot="scroll-area-thumb" className="relative flex-1 rounded-[0.125rem] bg-foreground/15" />
  </ScrollAreaPrimitive.Scrollbar>
))
ScrollBar.displayName = "ScrollBar"

const ScrollArea = React.forwardRef<
  HTMLDivElement,
  WithClassName<ScrollAreaPrimitive.Root.Props>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    data-slot="scroll-area"
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport data-slot="scroll-area-viewport" className="size-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = "ScrollArea"

export { ScrollArea, ScrollBar }
