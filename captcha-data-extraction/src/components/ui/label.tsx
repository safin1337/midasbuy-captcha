"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/*
 * Interior Label - a control label is 13px medium, never bold; leading-none
 * is banned on anything containing a word.
 */

// Base UI ships no Label primitive; a plain label carries the same semantics.
const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-[0.8125rem] font-medium leading-[1.125rem] text-foreground",
      "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
