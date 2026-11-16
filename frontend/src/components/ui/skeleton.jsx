import { cn } from "@/lib/utils";

/** Solid pulsing placeholder (no shimmer gradient). */
export function Skeleton({ className, ...props }) {
  return <span aria-hidden="true" className={cn("block animate-pulse-soft rounded-md bg-line", className)} {...props} />;
}
