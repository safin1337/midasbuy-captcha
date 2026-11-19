"use client";

import * as React from "react";
import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";

import { cn } from "@/lib/utils";
import type { WithClassName } from "./_shared";

/*
 * Interior HoverCard - the Popover panel raised by pointing instead of
 * clicking: 11px radius, popover float shadow, no border.
 */

const HoverCard = PreviewCardPrimitive.Root;
const HoverCardTrigger = PreviewCardPrimitive.Trigger;

const HoverCardContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<PreviewCardPrimitive.Popup.Props> &
    Pick<PreviewCardPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">
>(({ className, align = "center", alignOffset, side, sideOffset = 8, ...props }, ref) => (
  <PreviewCardPrimitive.Portal>
    <PreviewCardPrimitive.Positioner
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className="isolate z-50"
    >
      <PreviewCardPrimitive.Popup
        ref={ref}
        className={cn(
          "origin-(--transform-origin) z-50 w-64 rounded-[0.6875rem] bg-popover p-4 text-popover-foreground outline-none",
          "shadow-[var(--shadow-float-popover)]",
          "transition-[opacity,transform,scale] duration-fast",
          "data-starting-style:opacity-0 data-starting-style:scale-[0.97]",
          "data-ending-style:opacity-0 data-ending-style:scale-[0.97]",
          className,
        )}
        {...props}
      />
    </PreviewCardPrimitive.Positioner>
  </PreviewCardPrimitive.Portal>
));
HoverCardContent.displayName = "HoverCardContent";

export { HoverCard, HoverCardTrigger, HoverCardContent };
