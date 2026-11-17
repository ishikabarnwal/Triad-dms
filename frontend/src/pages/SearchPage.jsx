import { MagnifyingGlass, Warning } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { errorInfo } from "@/api/client";
import { searchDocuments } from "@/api/search";
import { RequestAccessDialog } from "@/components/AccessDialogs";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import PaginationBar from "@/components/PaginationBar";
import ResultCard from "@/components/search/ResultCard";
import SearchFilters, { activeFilters, ActiveFilterChips, filterKeys, metadataFilterFields } from "@/components/search/SearchFilters";
import SearchInput from "@/components/search/SearchInput";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import useDocumentTitle from "@/hooks/useDocumentTitle";
import useMetadataFields from "@/hooks/useMetadataFields";

const PAGE_SIZE = 10;
const EXAMPLE_COUNT = 3;
// Used only when the admin hasn't defined any select options to draw examples from.
const FALLBACK_EXAMPLES = ["report", "plan", "summary"];

/** Example searches from real metadata values: the first options of the filterable select fields. */
function exampleSearches(fields) {
  const fromFields = metadataFilterFields(fields)
    .filter((field) => field.type === "select")
    .flatMap((field) => field.options.slice(0, 2));
  const unique = [...new Set(fromFields)];
  return (unique.length ? unique : FALLBACK_EXAMPLES).slice(0, EXAMPLE_COUNT);
}

function ResultSkeleton() {
  return (
    <div className="card flex gap-4 p-5" aria-hidden="true">
      <Skeleton className="hidden size-11 rounded-xl sm:block" />
      <div className="flex-1 space-y-3">
        <div className="flex justify-between gap-4">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-6 w-28 rounded-md" />
        </div>
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-6 w-28 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** Before anything is typed: what search covers, and a few searches to try. */
function StartState({ examples, onPick }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <MagnifyingGlass className="size-7" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-bold tracking-[-0.02em]">Search across every division</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-pretty text-muted">
        Results cover titles, details and the words inside scanned files. Files from other divisions show their title and details only, until
        access is approved.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <span className="text-sm text-muted">Try</span>
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onPick(example)}
            className="h-8 cursor-pointer rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

function NoResults({ query, hasFilters, onClear }) {
  return (
    <div className="card px-6 py-14 text-center">
      <h2 className="text-lg font-bold tracking-[-0.02em]">{query ? `Nothing found for “${query}”` : "No documents match these filters"}</h2>
      <ul className="mx-auto mt-4 max-w-sm space-y-1.5 text-left text-sm text-muted">
        {query && <li>Check the spelling of each word.</li>}
        {query && <li>Try fewer or shorter words, such as part of a reference number.</li>}
        {hasFilters && <li>Remove a filter to widen the search.</li>}
      </ul>
      {hasFilters && (
        <Button variant="outline" className="mt-6" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

function summaryLine(total, query) {
  const count = `${total} ${total === 1 ? "result" : "results"}`;
  return query ? (
    <>
      {count} for <span className="font-bold text-ink">“{query}”</span>
    </>
  ) : (
    `${total} ${total === 1 ? "document matches" : "documents match"} these filters`
  );
}

export default function SearchPage() {
  useDocumentTitle("Search");
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { fields, loading: fieldsLoading } = useMetadataFields();
  const [state, setState] = useState({ results: [], total: 0, pages: 0, loading: false, error: "" });
  const [requesting, setRequesting] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const query = params.get("q") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const values = useMemo(() => Object.fromEntries(params.entries()), [params]);
  const chips = activeFilters(values, fields);
  const hasFilters = chips.length > 0;
  const idle = !query && !hasFilters;
  const from = `${location.pathname}${location.search}`;

  const update = useCallback(
    (changes, { replace = false } = {}) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
          return next;
        },
        { replace },
      );
    },
    [setParams],
  );

  // Typing replaces the history entry, so Back doesn't step through every pause in typing.
  const setQuery = useCallback((text) => update({ q: text, page: null }, { replace: true }), [update]);
  const setFilter = useCallback((key, value) => update({ [key]: value, page: null }), [update]);
  const clearFilters = () => update({ ...Object.fromEntries(filterKeys(fields).map((key) => [key, null])), page: null });

  useEffect(() => {
    if (idle || fieldsLoading) {
      setState((current) => ({ ...current, loading: false, error: "" }));
      return undefined;
    }
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    searchDocuments({ ...Object.fromEntries(params.entries()), limit: PAGE_SIZE })
      .then((response) => {
        if (active) {
          const { results, total, pages } = response.data;
          setState({ results, total, pages, loading: false, error: "" });
        }
      })
      .catch((error) => active && setState({ results: [], total: 0, pages: 0, loading: false, error: errorInfo(error).message }));
    return () => {
      active = false;
    };
  }, [params, idle, fieldsLoading, attempt]);

  // After a request is sent, show it as pending in place instead of searching again.
  const markRequested = (docId) =>
    setState((current) => ({
      ...current,
      results: current.results.map((result) =>
        result.id === docId ? { ...result, access_status: "pending", can_request_access: false } : result,
      ),
    }));

  let body;
  if (idle) {
    body = <StartState examples={exampleSearches(fields)} onPick={setQuery} />;
  } else if (state.loading || fieldsLoading) {
    body = (
      <div className="space-y-4" role="status" aria-label="Searching">
        {[0, 1, 2, 3].map((row) => (
          <ResultSkeleton key={row} />
        ))}
      </div>
    );
  } else if (state.error) {
    body = (
      <div className="card">
        <EmptyState
          Icon={Warning}
          title="Search didn't work"
          message={state.error}
          action={
            <Button variant="outline" onClick={() => setAttempt((count) => count + 1)}>
              Try again
            </Button>
          }
        />
      </div>
    );
  } else if (state.results.length === 0) {
    body = <NoResults query={query} hasFilters={hasFilters} onClear={clearFilters} />;
  } else {
    body = (
      <>
        <ol className="space-y-4" aria-label="Results">
          {state.results.map((result) => (
            <li key={result.id}>
              <ResultCard result={result} fields={fields} from={from} onRequest={setRequesting} />
            </li>
          ))}
        </ol>
        {state.pages > 1 && (
          <div className="card mt-4 overflow-hidden">
            <PaginationBar
              page={page}
              pages={state.pages}
              total={state.total}
              limit={PAGE_SIZE}
              onChange={(next) => {
                update({ page: next === 1 ? null : next });
                window.scrollTo({ top: 0 });
              }}
            />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Search" subtitle="Search titles, details and the text inside scanned files." />

      <div className="mb-6 space-y-4">
        <SearchInput value={query} onChange={setQuery} />
        <SearchFilters fields={fields} values={values} loading={fieldsLoading} onChange={setFilter} onClear={clearFilters} />
      </div>

      {!idle && !state.loading && !state.error && !fieldsLoading && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {state.total > 0 && (
            <p className="text-sm text-muted" aria-live="polite">
              {summaryLine(state.total, query)}
            </p>
          )}
          <ActiveFilterChips chips={chips} onRemove={(key) => setFilter(key, null)} />
        </div>
      )}

      {body}

      {requesting && (
        <RequestAccessDialog
          document={requesting}
          open={Boolean(requesting)}
          onOpenChange={(open) => !open && setRequesting(null)}
          // Without a new request in hand (it was already pending or approved), search again for the real state.
          onRequested={(created) => (created ? markRequested(requesting.id) : setAttempt((count) => count + 1))}
        />
      )}
    </>
  );
}
