import * as React from "react"
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { Check, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import type { WithClassName } from "./_shared"

/*
 * Interior Menubar - the bar is a lifted 9px panel with 3px padding, so its
 * 6px triggers nest exactly (9 = 6 + 3). An open trigger takes the well
 * tint, not the accent. The panels are the same 11px dropdown floats the
 * other menus use.
 */

const menuPopupStyles = [
  "z-50 min-w-[12rem] overflow-hidden rounded-[0.6875rem] p-[0.3125rem]",
  "bg-popover text-popover-foreground",
  "shadow-[var(--shadow-float-dropdown)]",
  "transition-[opacity,transform,scale] duration-fast",
  "data-starting-style:opacity-0 data-starting-style:scale-[0.97]",
  "data-ending-style:opacity-0 data-ending-style:scale-[0.97]",
].join("origin-(--transform-origin)  ")

const menuItemStyles = [
  "relative flex cursor-default select-none items-center gap-2 rounded-[0.375rem] px-2.5 py-1.5",
  "text-[0.8125rem] text-foreground outline-none",
  "transition-colors duration-fast",
  "focus:bg-secondary",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  "[&_svg]:size-4 [&_svg]:shrink-0",
].join(" ")

const Menubar = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenubarPrimitive.Props>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive
    ref={ref}
    className={cn(
      "flex h-9 items-center gap-0.5 rounded-[0.5625rem] bg-card p-[0.1875rem]",
      "shadow-[var(--shadow-lift)]",
      className
    )}
    {...props}
  />
))
Menubar.displayName = "Menubar"

const MenubarMenu = MenuPrimitive.Root
const MenubarGroup = MenuPrimitive.Group
const MenubarPortal = MenuPrimitive.Portal
const MenubarSub = MenuPrimitive.SubmenuRoot
const MenubarRadioGroup = MenuPrimitive.RadioGroup

const MenubarTrigger = React.forwardRef<
  HTMLButtonElement,
  WithClassName<MenuPrimitive.Trigger.Props>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-[0.375rem] px-2.5 py-1",
      "text-[0.8125rem] font-medium text-foreground outline-none",
      "transition-colors duration-fast",
      "focus:bg-secondary data-popup-open:bg-secondary",
      className
    )}
    {...props}
  />
))
MenubarTrigger.displayName = "MenubarTrigger"

const MenubarSubTrigger = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.SubmenuTrigger.Props> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <MenuPrimitive.SubmenuTrigger
    ref={ref}
    className={cn(menuItemStyles, "data-popup-open:bg-secondary", inset && "pl-8", className)}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" strokeWidth={1.5} />
  </MenuPrimitive.SubmenuTrigger>
))
MenubarSubTrigger.displayName = "MenubarSubTrigger"

const MenubarSubContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.Popup.Props>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Positioner className="isolate z-50" sideOffset={4}>
      <MenuPrimitive.Popup ref={ref} className={cn(menuPopupStyles, className)} {...props} />
    </MenuPrimitive.Positioner>
  </MenuPrimitive.Portal>
))
MenubarSubContent.displayName = "MenubarSubContent"

const MenubarContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.Popup.Props> &
    Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">
>(({ className, align = "start", alignOffset = -4, side, sideOffset = 8, ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Positioner
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className="isolate z-50"
    >
      <MenuPrimitive.Popup ref={ref} className={cn(menuPopupStyles, className)} {...props} />
    </MenuPrimitive.Positioner>
  </MenuPrimitive.Portal>
))
MenubarContent.displayName = "MenubarContent"

const MenubarItem = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.Item.Props> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <MenuPrimitive.Item ref={ref} className={cn(menuItemStyles, inset && "pl-8", className)} {...props} />
))
MenubarItem.displayName = "MenubarItem"

const MenubarCheckboxItem = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.CheckboxItem.Props>
>(({ className, children, ...props }, ref) => (
  <MenuPrimitive.CheckboxItem ref={ref} className={cn(menuItemStyles, "pl-8", className)} {...props}>
    <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
      <MenuPrimitive.CheckboxItemIndicator>
        <Check className="size-3.5 text-primary" strokeWidth={1.5} />
      </MenuPrimitive.CheckboxItemIndicator>
    </span>
    {children}
  </MenuPrimitive.CheckboxItem>
))
MenubarCheckboxItem.displayName = "MenubarCheckboxItem"

const MenubarRadioItem = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.RadioItem.Props>
>(({ className, children, ...props }, ref) => (
  <MenuPrimitive.RadioItem ref={ref} className={cn(menuItemStyles, "pl-8", className)} {...props}>
    <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
      <MenuPrimitive.RadioItemIndicator>
        <span className="block size-2 rounded-[0.0938rem] bg-primary shadow-[var(--shadow-thumb)]" />
      </MenuPrimitive.RadioItemIndicator>
    </span>
    {children}
  </MenuPrimitive.RadioItem>
))
MenubarRadioItem.displayName = "MenubarRadioItem"

const MenubarLabel = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.GroupLabel.Props> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <MenuPrimitive.GroupLabel
    ref={ref}
    className={cn(
      "px-2.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
MenubarLabel.displayName = "MenubarLabel"

const MenubarSeparator = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.Separator.Props>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Separator ref={ref} className={cn("-mx-[0.3125rem] my-[0.3125rem] h-px bg-border", className)} {...props} />
))
MenubarSeparator.displayName = "MenubarSeparator"

const MenubarShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn("ml-auto font-mono text-[0.6563rem] tabular-nums text-muted-foreground", className)}
    {...props}
  />
)
MenubarShortcut.displayName = "MenubarShortcut"

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
}
