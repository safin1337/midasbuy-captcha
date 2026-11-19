"use client";

import * as React from "react";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { Check, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WithClassName } from "./_shared";

/*
 * Interior ContextMenu - the DropdownMenu panel raised by a right click:
 * 11px radius, 5px padding, 6px rows, dropdown float shadow, well-tint
 * highlight. Never an accent-colored selection.
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

const ContextMenu = ContextMenuPrimitive.Root;
const ContextMenuTrigger = ContextMenuPrimitive.Trigger;
const ContextMenuGroup = ContextMenuPrimitive.Group;
const ContextMenuPortal = ContextMenuPrimitive.Portal;
const ContextMenuSub = ContextMenuPrimitive.SubmenuRoot;
const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const ContextMenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  WithClassName<ContextMenuPrimitive.SubmenuTrigger.Props> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <ContextMenuPrimitive.SubmenuTrigger
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
  </ContextMenuPrimitive.SubmenuTrigger>
));
ContextMenuSubTrigger.displayName = "ContextMenuSubTrigger";

const ContextMenuSubContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<ContextMenuPrimitive.Popup.Props>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Positioner className="isolate z-50" sideOffset={4}>
      <ContextMenuPrimitive.Popup
        ref={ref}
        className={cn(menuSurface, className)}
        {...props}
      />
    </ContextMenuPrimitive.Positioner>
  </ContextMenuPrimitive.Portal>
));
ContextMenuSubContent.displayName = "ContextMenuSubContent";

const ContextMenuContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<ContextMenuPrimitive.Popup.Props>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Positioner className="isolate z-50">
      <ContextMenuPrimitive.Popup
        ref={ref}
        className={cn(menuSurface, className)}
        {...props}
      />
    </ContextMenuPrimitive.Positioner>
  </ContextMenuPrimitive.Portal>
));
ContextMenuContent.displayName = "ContextMenuContent";

const ContextMenuItem = React.forwardRef<
  HTMLDivElement,
  WithClassName<ContextMenuPrimitive.Item.Props> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.Item
    ref={ref}
    className={cn(menuItem, inset && "pl-8", className)}
    {...props}
  />
));
ContextMenuItem.displayName = "ContextMenuItem";

const ContextMenuCheckboxItem = React.forwardRef<
  HTMLDivElement,
  WithClassName<ContextMenuPrimitive.CheckboxItem.Props>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(menuItem, "pl-8", className)}
    {...props}
  >
    <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
      <ContextMenuPrimitive.CheckboxItemIndicator>
        <Check className="size-3.5 text-primary" strokeWidth={1.5} />
      </ContextMenuPrimitive.CheckboxItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.CheckboxItem>
));
ContextMenuCheckboxItem.displayName = "ContextMenuCheckboxItem";

const ContextMenuRadioItem = React.forwardRef<
  HTMLDivElement,
  WithClassName<ContextMenuPrimitive.RadioItem.Props>
>(({ className, children, ...props }, ref) => (
  <ContextMenuPrimitive.RadioItem
    ref={ref}
    className={cn(menuItem, "pl-8", className)}
    {...props}
  >
    <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
      <ContextMenuPrimitive.RadioItemIndicator>
        {/* a square ink dot, because circles are banned */}
        <span className="block size-2 rounded-[0.0938rem] bg-primary shadow-[var(--shadow-thumb)]" />
      </ContextMenuPrimitive.RadioItemIndicator>
    </span>
    {children}
  </ContextMenuPrimitive.RadioItem>
));
ContextMenuRadioItem.displayName = "ContextMenuRadioItem";

const ContextMenuLabel = React.forwardRef<
  HTMLDivElement,
  WithClassName<ContextMenuPrimitive.GroupLabel.Props> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <ContextMenuPrimitive.GroupLabel
    ref={ref}
    className={cn(
      "px-2.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
ContextMenuLabel.displayName = "ContextMenuLabel";

const ContextMenuSeparator = React.forwardRef<
  HTMLDivElement,
  WithClassName<ContextMenuPrimitive.Separator.Props>
>(({ className, ...props }, ref) => (
  <ContextMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-[0.3125rem] my-[0.3125rem] h-px bg-border", className)}
    {...props}
  />
));
ContextMenuSeparator.displayName = "ContextMenuSeparator";

const ContextMenuShortcut = ({
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
ContextMenuShortcut.displayName = "ContextMenuShortcut";

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
