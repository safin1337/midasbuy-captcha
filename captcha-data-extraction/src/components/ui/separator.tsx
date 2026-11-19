import * as React from "react"
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"

import { cn } from "@/lib/utils"
import type { WithClassName } from "./_shared"

/*
 * Interior Separator - a hairline in the border ink. A rule divides; it never
 * carries elevation, so it stays 1px and flat.
 */

const Separator = React.forwardRef<
  HTMLDivElement,
  WithClassName<SeparatorPrimitive.Props>
>(({ className, orientation = "horizontal", ...props }, ref) => (
  <SeparatorPrimitive
    ref={ref}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
      className
    )}
    {...props}
  />
))
Separator.displayName = "Separator"

export { Separator }
