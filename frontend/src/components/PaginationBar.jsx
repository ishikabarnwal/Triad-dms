import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Page numbers around the current page, with gaps marked by null. */
function pageWindow(page, pages) {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  const result = [];
  sorted.forEach((n, index) => {
    if (index > 0 && n - sorted[index - 1] > 1) {
      result.push(null);
    }
    result.push(n);
  });
  return result;
}

const pageButton =
  "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-full px-2 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export default function PaginationBar({ page, pages, total, limit, onChange }) {
  if (!total) {
    return null;
  }
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <span className="label-mono text-muted">
        {first}–{last} / {total}
      </span>
      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            className={cn(pageButton, "hover:bg-lavender")}
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          {pageWindow(page, pages).map((n, index) =>
            n === null ? (
              <span key={`gap-${index}`} className="px-1 text-muted">
                …
              </span>
            ) : (
              <button
                type="button"
                key={n}
                className={cn(pageButton, n === page ? "bg-primary text-white" : "hover:bg-lavender")}
                aria-current={n === page ? "page" : undefined}
                onClick={() => onChange(n)}
              >
                {n}
              </button>
            ),
          )}
          <button
            type="button"
            className={cn(pageButton, "hover:bg-lavender")}
            disabled={page >= pages}
            onClick={() => onChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
