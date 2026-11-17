import { cn } from "@/lib/utils";
import { Skeleton } from "./ui/skeleton";

/** One dashboard number with its icon in a soft square. `dark` makes it the plum highlight card. */
export default function StatCard({ Icon, label, value, hint, loading, dark = false }) {
  return (
    <div className={cn(dark ? "card-dark" : "card", "flex h-full flex-col justify-between gap-5 p-5")}>
      <div className="flex items-center justify-between gap-3">
        <span className={cn("text-sm font-medium", dark ? "text-white/75" : "text-muted")}>{label}</span>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            dark ? "bg-white/10 text-white" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <div>
        {loading ? (
          <Skeleton className={cn("h-9 w-16", dark && "bg-white/15")} />
        ) : (
          <p className={cn("text-[2rem] leading-9 font-bold tracking-[-0.03em] tabular-nums", dark && "text-white")}>
            {value.toLocaleString("en-IN")}
          </p>
        )}
        {hint && <p className={cn("mt-1 text-xs", dark ? "text-white/60" : "text-muted")}>{hint}</p>}
      </div>
    </div>
  );
}
