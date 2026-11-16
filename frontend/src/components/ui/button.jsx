import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "group inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,color,border-color,transform] duration-150 select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-hover",
        plum: "bg-plum text-white hover:bg-plum-hover",
        outline: "border border-line bg-white text-ink hover:border-primary hover:text-primary",
        ghost: "text-ink hover:bg-lavender",
        onDark: "bg-white text-plum hover:bg-lavender",
        ghostDark: "border border-white/20 text-white hover:border-white/50",
        danger: "bg-danger text-white hover:opacity-90",
        link: "rounded-none px-0 text-primary hover:underline",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-13 px-7 text-base",
        icon: "size-10",
        iconSm: "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

/** Pill button. `asChild` renders the styles on a child element such as a router Link. */
export const Button = forwardRef(function Button({ className, variant, size, asChild = false, ...props }, ref) {
  const Component = asChild ? Slot : "button";
  return <Component ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

/** The arrow that nudges right when its button is hovered. */
export function ButtonArrow({ className }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("size-4 transition-transform duration-150 group-hover:translate-x-0.5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
