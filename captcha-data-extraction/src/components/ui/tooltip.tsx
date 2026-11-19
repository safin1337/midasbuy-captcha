"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"
import type { WithClassName } from "./_shared"

/*
 * Interior Tooltip - a small lifted panel, not an inverted black bubble: the
 * same white surface as every other float, at the 6px cap radius and the
 * hint size, carried by the popover float shadow.
 */

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<TooltipPrimitive.Popup.Props> &
    Pick<TooltipPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">
>(({ className, align, alignOffset, side, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Positioner
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className="isolate z-50"
    >
      <TooltipPrimitive.Popup
        ref={ref}
        className={cn(
          "origin-(--transform-origin) z-50 overflow-hidden rounded-[0.375rem] px-2.5 py-1.5",
          "bg-card text-[0.7188rem] font-medium text-foreground",
          "shadow-[var(--shadow-float-popover)]",
          "transition-[opacity,transform,scale] duration-fast",
          "data-starting-style:opacity-0 data-starting-style:scale-[0.97]",
          "data-ending-style:opacity-0 data-ending-style:scale-[0.97]",
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Positioner>
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
