import { cn } from "@/lib/utils";

/** A row of mutually exclusive options, like "My division / All divisions". */
export function SegmentedControl({ options, value, onChange, label, className }) {
  return (
    <div className={cn("inline-flex rounded-lg border border-line bg-lavender p-1", className)} role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            type="button"
            key={option.value}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-8 cursor-pointer rounded-md px-3.5 text-sm font-semibold transition-colors",
              selected ? "bg-white text-ink shadow-soft" : "text-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
