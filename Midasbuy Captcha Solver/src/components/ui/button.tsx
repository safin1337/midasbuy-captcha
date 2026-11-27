import * as React from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Interior Button - a key you could press.
 *
 * The primary action is an ink fill, not a blue one: accent marks interaction
 * and focus, never "this is the main button". The secondary is a cap - a
 * bottom lip and a hairline all round. Every variant presses down 1px, keeps
 * its width when its state changes, and draws focus without a ring: filled
 * surfaces get an outside line in the inverted accent (the accent is chosen
 * against the surface it is drawn on, not against the page), light surfaces
 * get an accent border plus a lift.
 */

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none",
    "rounded-[0.5625rem] text-[0.8125rem] font-medium leading-[1.25rem]",
    "transition-[background-color,border-color,box-shadow,transform] duration-fast",
    "focus-visible:outline-none",
    "active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground",
          "shadow-[var(--shadow-thumb)]",
          "hover:bg-primary/90",
          "focus-visible:shadow-[var(--shadow-thumb),0_0_0_0.0938rem_var(--ring-inverted)]",
        ].join(" "),
        secondary: [
          "bg-card text-foreground",
          "shadow-[var(--shadow-cap)]",
          "hover:bg-secondary",
          "focus-visible:shadow-[inset_0_0_0_0.0625rem_var(--ring),var(--shadow-focus-lift)]",
        ].join(" "),
        outline: [
          "border border-border bg-transparent text-foreground",
          "hover:bg-secondary hover:border-foreground/30",
          "focus-visible:border-ring focus-visible:shadow-[var(--shadow-focus-lift)]",
        ].join(" "),
        ghost: [
          "text-muted-foreground",
          "hover:bg-secondary hover:text-foreground",
          "focus-visible:bg-ring/[0.06] focus-visible:shadow-[inset_0_0_0_0.0625rem_var(--ring)]",
        ].join(" "),
        destructive: [
          "bg-destructive text-destructive-foreground",
          "shadow-[var(--shadow-thumb)]",
          "hover:bg-destructive/90",
          "focus-visible:shadow-[var(--shadow-thumb),0_0_0_0.0938rem_var(--ring-inverted)]",
        ].join(" "),
        link: "text-accent-foreground underline-offset-4 hover:underline focus-visible:underline",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 rounded-[0.5rem] px-3 text-xs",
        lg: "h-11 px-5",
        icon: "h-10 w-10 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends Omit<ButtonPrimitive.Props, "className">,
    VariantProps<typeof buttonVariants> {
  className?: string;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, className }));

    // Callers written against the Radix API pass the element to become as a
    // child: <Button asChild><Link>…</Link></Button>. Base UI has no asChild,
    // it composes through `render`. Without this the prop reaches the DOM and
    // the anchor nests inside the button instead of replacing it, which stacks
    // the icon above the label and puts a link inside a button.
    if (asChild && React.isValidElement(children)) {
      return (
        <ButtonPrimitive
          ref={ref}
          className={classes}
          {...props}
          // After the spread, so an explicit asChild child wins over a stray
          // render prop rather than being silently replaced by it.
          // SAFETY: this branch runs only when `asChild` is set, and the caller then
          // owns passing a single element for the slot to clone.
          render={children as React.ReactElement}
        />
      );
    }

    return (
      <ButtonPrimitive ref={ref} className={classes} {...props}>
        {children}
      </ButtonPrimitive>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
