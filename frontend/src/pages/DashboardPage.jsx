import { CalendarBlank, Files, Funnel, FolderOpen, Hourglass, Scan, UploadSimple, Warning } from "@phosphor-icons/react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { errorInfo } from "@/api/client";
import { listDocuments } from "@/api/documents";
import { getStats } from "@/api/stats";
import DocumentsTable, { ColumnsMenu, useDocumentsTable } from "@/components/DocumentsTable";
import EmptyState from "@/components/EmptyState";
import FilterBar, { SEARCH_KEY } from "@/components/FilterBar";
import PageHeader from "@/components/PageHeader";
import PaginationBar from "@/components/PaginationBar";
import RecentActivity from "@/components/RecentActivity";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import UploadModal from "@/components/UploadModal";
import { useAuth } from "@/context/AuthContext";
import useDocumentTitle from "@/hooks/useDocumentTitle";
import useMetadataFields from "@/hooks/useMetadataFields";

const PAGE_SIZE = 15;
const SCOPES = [
  { value: "division", label: "My division" },
  { value: "all", label: "All divisions" },
];

// recharts is large; load it after the rest of the dashboard.
const ReportChart = lazy(() => import("@/components/ReportChart"));

/** A white card with a title row, used for the chart and the activity feed. */
function Panel({ title, aside, className, children }) {
  return (
    <section className={`card flex flex-col p-6 ${className || ""}`}>
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold tracking-[-0.02em]">{title}</h2>
        {aside && <span className="text-sm text-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  useDocumentTitle("Dashboard");
  const { user, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const { fields, loading: fieldsLoading, error: fieldsError } = useMetadataFields();

  const [result, setResult] = useState({ documents: [], total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // The super admin oversees every division, so "All divisions" is their natural starting view.
  const defaultScope = isAdmin ? "all" : "division";
  const scope = ["all", "division"].includes(params.get("scope")) ? params.get("scope") : defaultScope;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const sort = params.get("sort") || "created_at";
  const order = params.get("order") === "asc" ? "asc" : "desc";
  const filterValues = useMemo(() => Object.fromEntries(params.entries()), [params]);
  const hasFilters = Boolean(params.get(SEARCH_KEY)) || fields.some((field) => field.filterable && params.get(field.key));

  const table = useDocumentsTable({ documents: result.documents, fields, sort, order });

  const loadDocuments = useCallback(() => {
    setLoading(true);
    setError("");
    // Every query param goes straight to the API: scope, page, sort, search and the metadata filters.
    listDocuments({ ...Object.fromEntries(params.entries()), scope, limit: PAGE_SIZE })
      .then((response) => setResult(response.data))
      .catch((err) => setError(errorInfo(err).message))
      .finally(() => setLoading(false));
  }, [params, scope]);

  const loadStats = useCallback(() => {
    getStats()
      .then((response) => setStats(response.data))
      .catch(() => setStats(null));
  }, []);

  useEffect(loadDocuments, [loadDocuments]);
  useEffect(loadStats, [loadStats]);

  const updateParams = useCallback(
    (changes) => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        Object.entries(changes).forEach(([key, value]) => {
          if (value === "" || value === null || value === undefined) {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        });
        return next;
      });
    },
    [setParams],
  );

  const setFilter = useCallback((key, value) => updateParams({ [key]: value, page: null }), [updateParams]);
  const setScope = (value) => updateParams({ scope: value === defaultScope ? null : value, page: null });
  const setSort = (key, nextOrder) =>
    updateParams({ sort: key === "created_at" ? null : key, order: nextOrder === "desc" ? null : nextOrder, page: null });
  const clearFilters = () => {
    const keep = {};
    ["scope", "sort", "order"].forEach((key) => params.get(key) && (keep[key] = params.get(key)));
    setParams(keep);
  };

  const afterUpload = () => {
    loadDocuments();
    loadStats();
  };

  const uploadButton = (
    <Button onClick={() => setUploadOpen(true)} disabled={fieldsLoading || Boolean(fieldsError)}>
      <UploadSimple className="size-4" weight="bold" aria-hidden="true" />
      Upload document
    </Button>
  );

  const statsLoading = !stats;
  const scopeName = isAdmin ? "All divisions" : user.division;
  const unreadable = stats?.ocr?.failed ?? 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={isAdmin ? "Every division at a glance." : `Documents in ${user.division}, plus anything shared with you.`}
        actions={uploadButton}
      />

      <section aria-label="Summary" className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard dark Icon={Files} label="Total documents" value={stats?.total_documents ?? 0} hint={scopeName} loading={statsLoading} />
        <StatCard Icon={CalendarBlank} label="Uploaded this week" value={stats?.uploaded_this_week ?? 0} hint="Last 7 days" loading={statsLoading} />
        <StatCard
          Icon={Hourglass}
          label="Pending requests"
          value={stats?.pending_requests ?? 0}
          hint={isAdmin ? "Across all divisions" : "Waiting on your division"}
          loading={statsLoading}
        />
        <StatCard
          Icon={Scan}
          label="Text extracted"
          value={stats?.ocr?.done ?? 0}
          hint={unreadable ? `${unreadable} could not be read` : "From every readable page"}
          loading={statsLoading}
        />
      </section>

      <div className="mb-6 grid gap-4 lg:grid-cols-12">
        <Panel title={`Documents by ${stats?.by_group?.field || "type"}`} aside={scopeName} className="lg:col-span-7">
          <div className="flex-1">
            <Suspense fallback={<Skeleton className="h-52 w-full rounded-xl" />}>
              <ReportChart group={stats?.by_group} loading={statsLoading} />
            </Suspense>
          </div>
        </Panel>
        <Panel title="Recent activity" className="lg:col-span-5">
          <RecentActivity events={stats?.recent_activity} loading={statsLoading} />
        </Panel>
      </div>

      <section aria-labelledby="documents-title" className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div className="flex items-baseline gap-2">
            <h2 id="documents-title" className="text-lg font-bold tracking-[-0.02em]">
              Documents
            </h2>
            {!loading && <span className="text-sm text-muted tabular-nums">{result.total}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl options={SCOPES} value={scope} onChange={setScope} label="Which documents to show" />
            <ColumnsMenu table={table} />
          </div>
        </div>

        <div className="border-b border-line px-5 py-4">
          {fieldsError ? (
            <p className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-ink" role="alert">
              <Warning className="size-4 shrink-0 text-danger" aria-hidden="true" />
              Couldn&apos;t load the filters: {errorInfo(fieldsError).message}
            </p>
          ) : (
            <FilterBar fields={fields} values={filterValues} onChange={setFilter} onClear={clearFilters} loading={fieldsLoading} />
          )}
        </div>

        {error ? (
          <EmptyState
            Icon={Warning}
            title="Couldn't load documents"
            message={error}
            action={
              <Button variant="outline" onClick={loadDocuments}>
                Try again
              </Button>
            }
          />
        ) : !loading && result.documents.length === 0 ? (
          <EmptyState
            Icon={hasFilters ? Funnel : FolderOpen}
            title={hasFilters ? "No documents match these filters" : "No documents yet"}
            message={
              hasFilters
                ? "Remove a filter, or switch to all divisions to see what other divisions hold."
                : "Upload the first document for your division. Scanned PDFs and images are read by OCR, so they can be searched by their text."
            }
            action={
              hasFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                uploadButton
              )
            }
          />
        ) : (
          <>
            <DocumentsTable table={table} loading={loading || fieldsLoading} sort={sort} order={order} onSortChange={setSort} />
            {!loading && (
              <PaginationBar
                page={page}
                pages={result.pages}
                total={result.total}
                limit={PAGE_SIZE}
                onChange={(next) => updateParams({ page: next === 1 ? null : next })}
              />
            )}
          </>
        )}
      </section>

      <UploadModal open={uploadOpen} fields={fields} onOpenChange={setUploadOpen} onUploaded={afterUpload} />
    </>
  );
}
