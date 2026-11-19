import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "@/lib/utils"
import type { WithClassName } from "./_shared"

/*
 * Interior Popover - an 11px-radius panel on the popover float shadow, no
 * border: the shadow alone says it floats. It arrives with a small 0.97 zoom
 * and leaves the same way.
 */

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger

// Base UI has no Anchor part (the trigger is the default anchor); the
// passthrough keeps the export drop-in compatible with the Radix variant.
const PopoverAnchor = ({ children }: { children?: React.ReactNode }) => <>{children}</>

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<PopoverPrimitive.Popup.Props> &
    Pick<PopoverPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">
>(({ className, align = "center", alignOffset, side, sideOffset = 8, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Positioner
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className="isolate z-50"
    >
      <PopoverPrimitive.Popup
        ref={ref}
        className={cn(
          "origin-(--transform-origin) z-50 w-72 rounded-[0.6875rem] p-4 outline-none",
          "bg-popover text-popover-foreground",
          "shadow-[var(--shadow-float-popover)]",
          "transition-[opacity,transform,scale] duration-base",
          "data-starting-style:opacity-0 data-starting-style:scale-[0.97]",
          "data-ending-style:opacity-0 data-ending-style:scale-[0.97]",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Positioner>
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
