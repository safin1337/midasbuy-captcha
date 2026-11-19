"use client";

import * as React from "react";
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WithClassName } from "./_shared";

/*
 * Interior Accordion - questions separated by hairline rules on the panel;
 * the divider is a compartment edge, never elevation. The trigger is a row
 * inside a container, so focus is the inset accent wash, and the chevron
 * turns as the answer opens.
 */

const Accordion = React.forwardRef<
  HTMLDivElement,
  WithClassName<AccordionPrimitive.Root.Props>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Root ref={ref} className={cn("w-full", className)} {...props} />
));
Accordion.displayName = "Accordion";

const AccordionItem = React.forwardRef<
  HTMLDivElement,
  WithClassName<AccordionPrimitive.Item.Props>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b border-border", className)}
    {...props}
  />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  HTMLButtonElement,
  WithClassName<AccordionPrimitive.Trigger.Props>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between gap-4 py-3.5 text-left",
        "text-[0.8125rem] font-medium leading-[1.4] text-foreground",
        "transition-[background-color,color,box-shadow] duration-fast",
        "hover:text-foreground/80",
        "focus-visible:outline-none focus-visible:bg-ring/[0.06] focus-visible:shadow-[inset_0_0_0_0.0625rem_var(--ring)]",
        "[&[data-panel-open]>svg]:rotate-180",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown
        strokeWidth={1.5}
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-base"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = React.forwardRef<
  HTMLDivElement,
  WithClassName<AccordionPrimitive.Panel.Props>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Panel
    ref={ref}
    className="overflow-hidden text-[0.8438rem] leading-relaxed text-muted-foreground"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Panel>
));
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
