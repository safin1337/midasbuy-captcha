import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"
import type { WithClassName } from "./_shared"

/*
 * Interior Switch - a slot with a key in it, not a pill. The track is a
 * recessed well at 6px radius; the thumb is a 4px-radius cap with a bottom
 * lip. On, the track takes the primary Button's flat ink fill and thumb
 * shadow, so the two controls read as one material. Focus is the outside
 * line, inverted accent on the ink track.
 */

const Switch = React.forwardRef<
  HTMLButtonElement,
  WithClassName<SwitchPrimitive.Root.Props>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-[1.375rem] w-[2.375rem] shrink-0 cursor-pointer items-center rounded-[0.375rem] p-[0.1875rem]",
      "bg-secondary shadow-[var(--shadow-well)]",
      "transition-[background-color,box-shadow] duration-fast",
      "focus-visible:outline-none focus-visible:shadow-[var(--shadow-well),0_0_0_0.0938rem_var(--ring)]",
      "data-disabled:cursor-not-allowed data-disabled:opacity-50",
      "data-checked:bg-primary data-checked:shadow-[var(--shadow-thumb)]",
      "data-checked:focus-visible:shadow-[var(--shadow-thumb),0_0_0_0.0938rem_var(--ring-inverted)]",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-4 rounded-[0.25rem] bg-card",
        "shadow-[var(--shadow-cap)]",
        "transition-transform duration-fast",
        "data-checked:translate-x-4 data-unchecked:translate-x-0"
      )}
    />
  </SwitchPrimitive.Root>
))
Switch.displayName = "Switch"

export { Switch }
