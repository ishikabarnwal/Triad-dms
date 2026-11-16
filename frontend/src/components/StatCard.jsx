import { cn } from "@/lib/utils";
import { CountUp } from "./motion";
import { Skeleton } from "./ui/skeleton";

/** One dashboard number. `dark` makes it the plum accent card. */
export default function StatCard({ Icon, code, label, value, hint, loading, dark = false }) {
  return (
    <div className={cn(dark ? "card-dark" : "card lift", "flex h-full flex-col justify-between gap-6 p-5")}>
      <div className="flex items-center justify-between">
        <span className={cn("label-mono", dark ? "text-white/55" : "text-muted")}>{code}</span>
        <Icon className={cn("size-4", dark ? "text-white/70" : "text-primary")} aria-hidden="true" />
      </div>
      <div>
        {loading ? (
          <Skeleton className={cn("h-9 w-14", dark && "bg-white/15")} />
        ) : (
          <CountUp value={value} className={cn("block text-4xl font-semibold tracking-[-0.04em]", dark && "text-white")} />
        )}
        <div className={cn("mt-1 text-sm", dark ? "text-white/70" : "text-muted")}>{label}</div>
        {hint && !loading && <div className={cn("text-xs", dark ? "text-white/50" : "text-muted")}>{hint}</div>}
      </div>
    </div>
  );
}
