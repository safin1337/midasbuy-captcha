"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "@/lib/utils"
import type { WithClassName } from "./_shared"

/*
 * Interior Progress - a 4px-radius track cut into the panel as a well, and a
 * 2px-radius accent fill. Live progress is the system responding to you right
 * now, which is exactly what the accent is for. The fill glides; it never
 * springs past the number it is reporting.
 */

const Progress = React.forwardRef<
  HTMLDivElement,
  WithClassName<ProgressPrimitive.Root.Props>
>(({ className, ...props }, ref) => (
  <ProgressPrimitive.Root ref={ref} className={cn("w-full", className)} {...props}>
    <ProgressPrimitive.Track className="relative h-[0.375rem] w-full overflow-hidden rounded-[0.25rem] bg-secondary shadow-[var(--shadow-well)]">
      <ProgressPrimitive.Indicator className="h-full rounded-[0.125rem] bg-ring transition-all duration-slow ease-out" />
    </ProgressPrimitive.Track>
  </ProgressPrimitive.Root>
))
Progress.displayName = "Progress"

export { Progress }
