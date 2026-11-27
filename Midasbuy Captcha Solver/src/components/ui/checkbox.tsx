"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/*
 * Interior Checkbox - a 5px-radius cell, per the nested radii scale; never a
 * rounded-full or a 4px shadcn default. Unchecked it is a recessed well.
 * Checked it takes the same flat ink fill and thumb shadow as the primary
 * Button - one material, scaled down. Focus is drawn inset in accent, since
 * a cell has no room outside itself.
 */

// Base UI splits Radix's checked="indeterminate" into a separate boolean prop;
// the wrapper keeps the Radix-shaped `checked` API and maps it.
type CheckboxProps = Omit<
  CheckboxPrimitive.Root.Props,
  "className" | "checked"
> & {
  className?: string;
  checked?: boolean | "indeterminate";
};

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked, ...props }, ref) => {
    const isIndeterminate = checked === "indeterminate";
    return (
      <CheckboxPrimitive.Root
        data-slot="checkbox"
        ref={ref}
        className={cn(
          "peer size-[1.125rem] shrink-0 rounded-[0.3125rem]",
          "border-2 border-border bg-input",
          "shadow-[var(--shadow-well)]",
          "transition-[background-color,border-color,box-shadow] duration-fast",
          "focus-visible:outline-none focus-visible:border-ring focus-visible:bg-card focus-visible:shadow-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "data-checked:border-primary data-checked:bg-primary",
          "data-checked:shadow-[var(--shadow-thumb)]",
          "data-checked:focus-visible:shadow-[var(--shadow-thumb),0_0_0_0.0938rem_var(--ring-inverted)]",
          "data-indeterminate:border-primary data-indeterminate:bg-primary",
          "data-indeterminate:shadow-[var(--shadow-thumb)]",
          "data-indeterminate:focus-visible:shadow-[var(--shadow-thumb),0_0_0_0.0938rem_var(--ring-inverted)]",
          className,
        )}
        checked={isIndeterminate ? false : checked}
        indeterminate={isIndeterminate}
        nativeButton
        render={<button type="button" />}
        {...props}
      >
        <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="size-full flex items-center justify-center text-primary-foreground">
          {isIndeterminate ? (
            <Minus className="size-3" strokeWidth={2.5} />
          ) : (
            <Check className="size-3" strokeWidth={2.5} />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
