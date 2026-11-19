import * as React from "react"
import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu"
import { cva } from "class-variance-authority"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import type { WithClassName } from "./_shared"

/*
 * Interior NavigationMenu - 9px button-radius triggers that take the well
 * tint when hovered or open, never the accent. The viewport is an 11px panel
 * on the popover float shadow, borderless like every other float. Focus is
 * the inset shape: a faint accent wash plus a 1px inner line.
 */

const NavigationMenu = React.forwardRef<
  HTMLElement,
  WithClassName<NavigationMenuPrimitive.Root.Props>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Root
    ref={ref}
    className={cn("relative z-10 flex max-w-max flex-1 items-center justify-center", className)}
    {...props}
  >
    {children}
    <NavigationMenuPrimitive.Portal>
      <NavigationMenuPrimitive.Positioner className="isolate z-50" sideOffset={8}>
        <NavigationMenuPrimitive.Popup
          className={cn(
            "relative origin-(--transform-origin) overflow-hidden rounded-[0.6875rem]",
            "bg-popover text-popover-foreground",
            "shadow-[var(--shadow-float-popover)]",
            "transition-[opacity,transform,scale] duration-fast",
            "data-starting-style:opacity-0 data-starting-style:scale-[0.97]",
            "data-ending-style:opacity-0 data-ending-style:scale-[0.97]"
          )}
        >
          <NavigationMenuPrimitive.Viewport />
        </NavigationMenuPrimitive.Popup>
      </NavigationMenuPrimitive.Positioner>
    </NavigationMenuPrimitive.Portal>
  </NavigationMenuPrimitive.Root>
))
NavigationMenu.displayName = "NavigationMenu"

const NavigationMenuList = React.forwardRef<
  HTMLUListElement,
  WithClassName<NavigationMenuPrimitive.List.Props>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn("group flex flex-1 list-none items-center justify-center gap-1", className)}
    {...props}
  />
))
NavigationMenuList.displayName = "NavigationMenuList"

const NavigationMenuItem = NavigationMenuPrimitive.Item

const navigationMenuTriggerStyle = cva(
  [
    "inline-flex h-9 w-max items-center justify-center rounded-[0.5625rem] px-3.5",
    "text-[0.8125rem] font-medium text-foreground",
    "transition-[background-color,box-shadow] duration-fast",
    "hover:bg-secondary",
    "focus-visible:outline-none focus-visible:bg-ring/[0.06] focus-visible:shadow-[inset_0_0_0_0.0625rem_var(--ring)]",
    "data-disabled:pointer-events-none data-disabled:opacity-50",
    "data-popup-open:bg-secondary",
  ].join(" ")
)

const NavigationMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  WithClassName<NavigationMenuPrimitive.Trigger.Props>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(navigationMenuTriggerStyle(), "group", className)}
    {...props}
  >
    {children}
    <ChevronDown
      aria-hidden
      strokeWidth={1.5}
      className="relative top-px ml-1 size-3 text-muted-foreground transition-transform duration-base group-data-popup-open:rotate-180"
    />
  </NavigationMenuPrimitive.Trigger>
))
NavigationMenuTrigger.displayName = "NavigationMenuTrigger"

const NavigationMenuContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<NavigationMenuPrimitive.Content.Props>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content ref={ref} className={cn("p-4", className)} {...props} />
))
NavigationMenuContent.displayName = "NavigationMenuContent"

const NavigationMenuLink = NavigationMenuPrimitive.Link

// Base UI renders the viewport inside Root's popup, so these two exports are
// passthroughs that keep the Radix-shaped API drop-in compatible.
const NavigationMenuViewport = ({ children }: { children?: React.ReactNode }) => <>{children}</>
const NavigationMenuIndicator = ({ children }: { children?: React.ReactNode }) => <>{children}</>

export {
  navigationMenuTriggerStyle,
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
}
