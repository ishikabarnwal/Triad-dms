import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "group inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xs font-semibold whitespace-nowrap transition-[background-color,color,border-color,transform] duration-200 ease-file select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-ink",
        plum: "bg-plum text-paper hover:bg-ink",
        outline: "border border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
        ghost: "text-ink underline-offset-4 hover:underline",
        onDark: "bg-paper text-plum hover:bg-white",
        ghostDark: "border border-paper/40 text-paper hover:border-paper hover:bg-paper hover:text-plum",
        danger: "border border-danger bg-transparent text-ink hover:bg-danger hover:text-white",
        link: "rounded-none px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 button-md",
        lg: "h-12 px-8 text-base",
        icon: "size-11",
        iconSm: "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

/** Rectangular button. `asChild` renders the styles on a child element such as a router Link. */
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
      className={cn("size-4 transition-transform duration-200 ease-file group-hover:translate-x-0.5", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="square"
    >
      <path d="M2 8h11M9 4l4 4-4 4" />
    </svg>
  );
}
