import { AlertTriangle, CalendarDays, FileStack, Filter, FolderOpen, Hourglass, ScanText, UploadCloud } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { errorInfo } from "@/api/client";
import { listDocuments } from "@/api/documents";
import { getStats } from "@/api/stats";
import DocumentsTable, { ColumnsMenu, useDocumentsTable } from "@/components/DocumentsTable";
import EmptyState from "@/components/EmptyState";
import FilterBar from "@/components/FilterBar";
import PageHeader from "@/components/PageHeader";
import PaginationBar from "@/components/PaginationBar";
import StatCard from "@/components/StatCard";
import { Button, ButtonArrow } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import UploadModal from "@/components/UploadModal";
import { useAuth } from "@/context/AuthContext";
import useDivisionCodes from "@/hooks/useDivisions";
import useMetadataFields from "@/hooks/useMetadataFields";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

// recharts is large; load it after the rest of the dashboard.
const ReportChart = lazy(() => import("@/components/ReportChart"));

function ScopeToggle({ scope, onChange }) {
  const options = [
    { value: "division", label: "My division" },
    { value: "all", label: "All divisions" },
  ];
  return (
    <div className="inline-flex rounded-full border border-line bg-white p-1" role="group" aria-label="Which documents to show">
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          aria-pressed={scope === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-8 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors",
            scope === option.value ? "bg-plum text-white" : "text-muted hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const codes = useDivisionCodes();
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
  const hasFilters = fields.some((field) => field.filterable && params.get(field.key));

  const table = useDocumentsTable({ documents: result.documents, fields, sort, order });

  const loadDocuments = useCallback(() => {
    setLoading(true);
    setError("");
    // Every query param goes straight to the API: scope, page, sort plus the metadata filters.
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

  const updateParams = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === "" || value === null || value === undefined) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });
    setParams(next);
  };

  const setFilter = (key, value) => updateParams({ [key]: value, page: null });
  const setScope = (value) => updateParams({ scope: value === defaultScope ? null : value, page: null });
  const setSort = (key, nextOrder) => updateParams({ sort: key === "created_at" ? null : key, order: nextOrder === "desc" ? null : nextOrder, page: null });
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
      <UploadCloud className="size-4" aria-hidden="true" />
      Upload document
      <ButtonArrow />
    </Button>
  );

  const divisionCode = isAdmin ? "ALL.DIVISIONS" : codes[user.division] || user.division;
  const statsLoading = !stats;

  return (
    <>
      <PageHeader
        code={`[ HUB ] ${divisionCode}`}
        title="Document Hub"
        subtitle={isAdmin ? "Every division, at a glance." : `${user.division} documents, plus anything shared with you.`}
        actions={uploadButton}
      />

      <div className="mb-8 grid gap-4 xl:grid-cols-12">
        <div className="grid grid-cols-2 gap-4 xl:col-span-7">
          <StatCard dark Icon={FileStack} code="DOCS.TOTAL" label="Total documents" value={stats?.total_documents ?? 0} loading={statsLoading} />
          <StatCard Icon={CalendarDays} code="LAST.7D" label="Uploaded this week" value={stats?.uploaded_this_week ?? 0} loading={statsLoading} />
          <StatCard
            Icon={Hourglass}
            code="REQ.PENDING"
            label="Pending requests"
            hint={isAdmin ? "Across all divisions" : "Waiting on your division"}
            value={stats?.pending_requests ?? 0}
            loading={statsLoading}
          />
          <StatCard Icon={ScanText} code="OCR.DONE" label="Text extracted" value={stats?.ocr?.done ?? 0} loading={statsLoading} />
        </div>
        <div className="card p-5 xl:col-span-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <div className="label-mono text-muted">Breakdown</div>
              <h2 className="mt-1 font-semibold tracking-tight">Documents by {stats?.by_group?.field || "type"}</h2>
            </div>
            <span className="label-mono rounded-full border border-line px-2.5 py-1 text-muted">{divisionCode}</span>
          </div>
          <Suspense fallback={<Skeleton className="h-52 w-full rounded-xl" />}>
            <ReportChart group={stats?.by_group} loading={statsLoading} />
          </Suspense>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ScopeToggle scope={scope} onChange={setScope} />
        <div className="flex items-center gap-2">
          {!loading && (
            <span className="label-mono text-muted">
              {result.total} {result.total === 1 ? "doc" : "docs"}
            </span>
          )}
          <ColumnsMenu table={table} />
        </div>
      </div>

      {fieldsError && (
        <div className="mb-4 rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
          Couldn&apos;t load metadata fields: {errorInfo(fieldsError).message}
        </div>
      )}
      <div className="mb-4">
        <FilterBar fields={fields} values={filterValues} onChange={setFilter} onClear={clearFilters} loading={fieldsLoading} />
      </div>

      <div className="card overflow-hidden">
        {error ? (
          <EmptyState
            Icon={AlertTriangle}
            code="ERR.FETCH"
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
            Icon={hasFilters ? Filter : FolderOpen}
            code={hasFilters ? "0 MATCHES" : "EMPTY.ARCHIVE"}
            title={hasFilters ? "No documents match these filters" : "No documents yet"}
            message={
              hasFilters
                ? "Remove a filter or switch to all divisions."
                : "Upload the first document for your division. Scanned PDFs and images are read with OCR automatically."
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
      </div>

      <UploadModal open={uploadOpen} fields={fields} onOpenChange={setUploadOpen} onUploaded={afterUpload} />
    </>
  );
}
