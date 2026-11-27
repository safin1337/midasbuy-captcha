export const formFieldBase =
  "w-full rounded-[0.625rem] px-3 text-[0.8125rem] leading-[1.25rem] " +
  "border-2 border-border bg-input text-foreground " +
  "shadow-[var(--shadow-well)] " +
  "placeholder:text-muted-foreground " +
  "transition-[background-color,border-color,box-shadow] duration-fast " +
  "focus-visible:outline-none focus-visible:border-ring focus-visible:bg-card focus-visible:shadow-none " +
  "aria-invalid:border-destructive aria-invalid:bg-card " +
  "disabled:cursor-not-allowed disabled:opacity-50"

export const formFieldSingleLine = "flex h-10 py-2"
export const formFieldMultiLine = "flex min-h-[5.5rem] py-2.5 resize-y"

/* Base UI passes a state object to className; the wrappers feed cn(), so the
 * prop is narrowed to a plain string throughout this variant. */
export type WithClassName<P> = Omit<P, "className"> & { className?: string }
