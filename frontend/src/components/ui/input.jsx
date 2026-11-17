import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-lg border bg-white px-3.5 text-sm text-ink transition-colors placeholder:text-muted/70 focus:outline-none focus-visible:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-lavender disabled:text-muted";

export const Input = forwardRef(function Input({ className, invalid, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(fieldBase, "h-11", invalid ? "border-danger" : "border-line", className)}
      {...props}
    />
  );
});

/** A styled native select: fully accessible and works the same on every device. */
export const NativeSelect = forwardRef(function NativeSelect({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(fieldBase, "h-11 appearance-none pr-10", invalid ? "border-danger" : "border-line", className)}
        {...props}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </div>
  );
});
