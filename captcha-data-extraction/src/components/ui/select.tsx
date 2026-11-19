import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { formFieldBase, formFieldSingleLine } from "./_shared"
import type { WithClassName } from "./_shared"

/*
 * Interior Select - the trigger is the field recipe: a recessed well that
 * rises to the surface when entered. The open panel floats on the dropdown
 * shadow alone; no border carries its elevation. The highlighted row is a
 * secondary wash and the chosen row says so with a quiet tick - accent never
 * marks "selected".
 */

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  WithClassName<SelectPrimitive.Trigger.Props>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      formFieldBase,
      formFieldSingleLine,
      "items-center justify-between gap-2 text-left",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = "SelectTrigger"

const SelectScrollUpButton = React.forwardRef<
  HTMLDivElement,
  WithClassName<SelectPrimitive.ScrollUpArrow.Props>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpArrow
    ref={ref}
    className={cn("flex items-center justify-center py-1 text-muted-foreground", className)}
    {...props}
  >
    <ChevronUp className="size-4" strokeWidth={1.5} />
  </SelectPrimitive.ScrollUpArrow>
))
SelectScrollUpButton.displayName = "SelectScrollUpButton"

const SelectScrollDownButton = React.forwardRef<
  HTMLDivElement,
  WithClassName<SelectPrimitive.ScrollDownArrow.Props>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownArrow
    ref={ref}
    className={cn("flex items-center justify-center py-1 text-muted-foreground", className)}
    {...props}
  >
    <ChevronDown className="size-4" strokeWidth={1.5} />
  </SelectPrimitive.ScrollDownArrow>
))
SelectScrollDownButton.displayName = "SelectScrollDownButton"

const SelectContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<SelectPrimitive.Popup.Props> &
    Pick<SelectPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">
>(({ className, children, align, alignOffset, side, sideOffset = 6, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Positioner
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className="isolate z-50"
    >
      <SelectPrimitive.Popup
        ref={ref}
        className={cn(
          "origin-(--transform-origin) relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-[0.6875rem] p-[0.3125rem]",
          "bg-popover text-popover-foreground",
          "shadow-[var(--shadow-float-dropdown)]",
          "transition-[opacity,transform,scale] duration-fast",
          "data-starting-style:opacity-0 data-starting-style:scale-[0.97]",
          "data-ending-style:opacity-0 data-ending-style:scale-[0.97]",
          className
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.List>{children}</SelectPrimitive.List>
        <SelectScrollDownButton />
      </SelectPrimitive.Popup>
    </SelectPrimitive.Positioner>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = "SelectContent"

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  WithClassName<SelectPrimitive.GroupLabel.Props>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.GroupLabel
    ref={ref}
    className={cn(
      "px-2.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
      className
    )}
    {...props}
  />
))
SelectLabel.displayName = "SelectLabel"

const SelectItem = React.forwardRef<
  HTMLDivElement,
  WithClassName<SelectPrimitive.Item.Props>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-[0.375rem] py-1.5 pl-8 pr-2.5",
      "text-[0.8125rem] text-foreground outline-none",
      "transition-[background-color] duration-fast",
      "data-highlighted:bg-secondary",
      "data-disabled:pointer-events-none data-disabled:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-3.5 text-foreground" strokeWidth={1.5} />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = "SelectItem"

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  WithClassName<SelectPrimitive.Separator.Props>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn("-mx-[0.3125rem] my-[0.3125rem] h-px bg-border", className)} {...props} />
))
SelectSeparator.displayName = "SelectSeparator"

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
