"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Base UI ships no AspectRatio primitive; the CSS property covers it.
export interface AspectRatioProps
  extends React.HTMLAttributes<HTMLDivElement> {
  ratio?: number;
}

const AspectRatio = React.forwardRef<HTMLDivElement, AspectRatioProps>(
  ({ className, ratio = 1, style, ...props }, ref) => (
    <div
      ref={ref}
      style={{ aspectRatio: String(ratio), ...style }}
      className={cn("relative w-full", className)}
      {...props}
    />
  ),
);
AspectRatio.displayName = "AspectRatio";

export { AspectRatio };
