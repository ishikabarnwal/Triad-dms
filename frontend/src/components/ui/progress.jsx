import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export function Progress({ value = 0, className, label = "Progress" }) {
  return (
    <ProgressPrimitive.Root value={value} aria-label={label} className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-line", className)}>
      <ProgressPrimitive.Indicator
        className="h-full rounded-full bg-primary transition-[width] duration-150"
        style={{ width: `${value}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
