import { Pagination } from "react-bootstrap";

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

export default function PaginationBar({ page, pages, total, limit, onChange }) {
  if (!total) {
    return null;
  }
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-3 border-top">
      <span className="small text-muted-soft">
        Showing {first}–{last} of {total}
      </span>
      {pages > 1 && (
        <Pagination size="sm" className="mb-0">
          <Pagination.Prev disabled={page <= 1} onClick={() => onChange(page - 1)} />
          {pageWindow(page, pages).map((n, index) =>
            n === null ? (
              <Pagination.Ellipsis key={`gap-${index}`} disabled />
            ) : (
              <Pagination.Item key={n} active={n === page} onClick={() => onChange(n)}>
                {n}
              </Pagination.Item>
            ),
          )}
          <Pagination.Next disabled={page >= pages} onClick={() => onChange(page + 1)} />
        </Pagination>
      )}
    </div>
  );
}
