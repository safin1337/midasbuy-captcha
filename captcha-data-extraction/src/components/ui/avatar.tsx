"use client";

import * as React from "react";
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";

import { cn } from "@/lib/utils";
import type { WithClassName } from "./_shared";

/*
 * Interior Avatar - a square tile on the 10px field radius, never a circle:
 * circles are banned everywhere but the spinner arc. While the image loads,
 * the fallback is a well - initials seated in a recessed slot cut into the
 * panel, the same material every empty container here uses.
 */

const Avatar = React.forwardRef<
  HTMLSpanElement,
  WithClassName<AvatarPrimitive.Root.Props>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex size-9 shrink-0 overflow-hidden rounded-[0.625rem]",
      className,
    )}
    {...props}
  />
));
Avatar.displayName = "Avatar";

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  WithClassName<AvatarPrimitive.Image.Props>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square size-full object-cover", className)}
    {...props}
  />
));
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  WithClassName<AvatarPrimitive.Fallback.Props>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex size-full items-center justify-center",
      "bg-secondary text-[0.6875rem] font-medium text-secondary-foreground",
      "shadow-[var(--shadow-well)]",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
