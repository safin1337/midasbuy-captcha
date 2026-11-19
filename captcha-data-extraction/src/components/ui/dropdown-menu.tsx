"use client";

import * as React from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Check, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WithClassName } from "./_shared";

/*
 * Interior DropdownMenu - an 11px-radius panel with 5px padding, so the 6px
 * rows nest exactly (11 = 6 + 5). The dropdown float shadow carries the
 * elevation; no border. A highlighted row is the well tint, never the
 * accent: accent marks interaction and focus, not "the row under the
 * cursor". The radio mark is a square ink dot, because circles are banned.
 */

const menuSurface = [
  "z-50 min-w-[10rem] overflow-hidden rounded-[0.6875rem] p-[0.3125rem]",
  "bg-popover text-popover-foreground",
  "shadow-[var(--shadow-float-dropdown)]",
  "transition-[opacity,transform,scale] duration-fast",
  "data-starting-style:opacity-0 data-starting-style:scale-[0.97]",
  "data-ending-style:opacity-0 data-ending-style:scale-[0.97]",
].join("origin-(--transform-origin)  ");

const menuItem = [
  "relative flex cursor-default select-none items-center gap-2 rounded-[0.375rem] px-2.5 py-1.5",
  "text-[0.8125rem] text-foreground outline-none",
  "transition-colors duration-fast",
  "focus:bg-secondary",
  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  "[&_svg]:size-4 [&_svg]:shrink-0",
].join(" ");

const DropdownMenu = MenuPrimitive.Root;
const DropdownMenuTrigger = MenuPrimitive.Trigger;
const DropdownMenuGroup = MenuPrimitive.Group;
const DropdownMenuPortal = MenuPrimitive.Portal;
const DropdownMenuSub = MenuPrimitive.SubmenuRoot;
const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.SubmenuTrigger.Props> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <MenuPrimitive.SubmenuTrigger
    ref={ref}
    className={cn(
      menuItem,
      "data-popup-open:bg-secondary",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" strokeWidth={1.5} />
  </MenuPrimitive.SubmenuTrigger>
));
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

const DropdownMenuSubContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.Popup.Props>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Positioner className="isolate z-50" sideOffset={4}>
      <MenuPrimitive.Popup
        ref={ref}
        className={cn(menuSurface, className)}
        {...props}
      />
    </MenuPrimitive.Positioner>
  </MenuPrimitive.Portal>
));
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.Popup.Props> &
    Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">
>(({ className, align = "center", alignOffset, side, sideOffset = 6, ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Positioner
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className="isolate z-50"
    >
      <MenuPrimitive.Popup
        ref={ref}
        className={cn(menuSurface, className)}
        {...props}
      />
    </MenuPrimitive.Positioner>
  </MenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.Item.Props> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <MenuPrimitive.Item
    ref={ref}
    className={cn(menuItem, inset && "pl-8", className)}
    {...props}
  />
));
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuCheckboxItem = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.CheckboxItem.Props>
>(({ className, children, ...props }, ref) => (
  <MenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(menuItem, "pl-8", className)}
    {...props}
  >
    <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
      <MenuPrimitive.CheckboxItemIndicator>
        <Check className="size-3.5 text-primary" strokeWidth={1.5} />
      </MenuPrimitive.CheckboxItemIndicator>
    </span>
    {children}
  </MenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

const DropdownMenuRadioItem = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.RadioItem.Props>
>(({ className, children, ...props }, ref) => (
  <MenuPrimitive.RadioItem
    ref={ref}
    className={cn(menuItem, "pl-8", className)}
    {...props}
  >
    <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
      <MenuPrimitive.RadioItemIndicator>
        {/* a square ink dot, because circles are banned */}
        <span className="block size-2 rounded-[0.0938rem] bg-primary shadow-[var(--shadow-thumb)]" />
      </MenuPrimitive.RadioItemIndicator>
    </span>
    {children}
  </MenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

const DropdownMenuLabel = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.GroupLabel.Props> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <MenuPrimitive.GroupLabel
    ref={ref}
    className={cn(
      "px-2.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  WithClassName<MenuPrimitive.Separator.Props>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-[0.3125rem] my-[0.3125rem] h-px bg-border", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      "ml-auto font-mono text-[0.6563rem] tabular-nums text-muted-foreground",
      className,
    )}
    {...props}
  />
);
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
