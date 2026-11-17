import { cn } from "@/lib/utils";

/**
 * The Ink banner that opens and closes every classified page.
 * `short` is what fits on a phone; the full marking shows from the small breakpoint up.
 */
export default function ClassificationStrip({ marking, short, className, as: Tag = "div" }) {
  return (
    <Tag className={cn("flex h-8 items-center justify-center bg-ink px-4 text-paper", className)}>
      <p className="label-mono truncate text-center">
        {short ? (
          <>
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{marking}</span>
          </>
        ) : (
          marking
        )}
      </p>
    </Tag>
  );
}
