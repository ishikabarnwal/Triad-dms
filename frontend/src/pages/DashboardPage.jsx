import { AlertTriangle, ArrowRight, Building2, CalendarDays, CloudUpload, Filter, FolderOpen, Globe, Hourglass, ScanText } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Col, Row } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import { errorInfo } from "../api/client";
import { listDocuments } from "../api/documents";
import { getStats } from "../api/stats";
import DocumentsTable from "../components/DocumentsTable";
import EmptyState from "../components/EmptyState";
import FilterBar from "../components/FilterBar";
import PageHeader from "../components/PageHeader";
import PaginationBar from "../components/PaginationBar";
import StatCard from "../components/StatCard";
import UploadModal from "../components/UploadModal";
import { useAuth } from "../context/AuthContext";
import useMetadataFields from "../hooks/useMetadataFields";

const PAGE_SIZE = 15;

// recharts is large; load it after the rest of the dashboard.
const ReportChart = lazy(() => import("../components/ReportChart"));
const chartPlaceholder = <span className="skeleton w-100" style={{ height: 220 }} />;

function StatsRow({ stats, isAdmin }) {
  const loading = !stats;
  const cards = [
    { Icon: FolderOpen, label: "Total documents", value: stats?.total_documents, dark: true },
    { Icon: CalendarDays, label: "Uploaded this week", value: stats?.uploaded_this_week },
    {
      Icon: Hourglass,
      label: "Pending requests",
      value: stats?.pending_requests,
      hint: isAdmin ? "Across all divisions" : "Waiting on your division",
    },
    { Icon: ScanText, label: "Text extracted (OCR)", value: stats?.ocr?.done },
  ];
  return (
    <Row className="g-3">
      {cards.map((card) => (
        <Col key={card.label} xs={6}>
          <StatCard {...card} value={card.value ?? 0} loading={loading} />
        </Col>
      ))}
    </Row>
  );
}

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const { fields, loading: fieldsLoading, error: fieldsError } = useMetadataFields();

  const [result, setResult] = useState({ documents: [], total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  // The super admin oversees every division, so "All Divisions" is their natural starting view.
  const defaultScope = isAdmin ? "all" : "division";
  const scope = ["all", "division"].includes(params.get("scope")) ? params.get("scope") : defaultScope;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const filterValues = useMemo(() => Object.fromEntries(params.entries()), [params]);
  const hasFilters = fields.some((field) => field.filterable && params.get(field.key));

  const loadDocuments = useCallback(() => {
    setLoading(true);
    setError("");
    // Every query param goes straight to the API: scope/page plus the metadata filters.
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
  const clearFilters = () => setParams(scope === defaultScope ? {} : { scope });

  const afterUpload = () => {
    loadDocuments();
    loadStats();
  };

  const uploadButton = (
    <Button onClick={() => setShowUpload(true)} disabled={fieldsLoading || Boolean(fieldsError)}>
      <CloudUpload size={17} aria-hidden="true" />
      Upload document
      <ArrowRight size={16} className="btn-arrow" aria-hidden="true" />
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Document Hub"
        subtitle={isAdmin ? "Every division, at a glance." : `${user.division} documents, plus anything shared with you.`}
        actions={uploadButton}
      />

      <Row className="g-3 mb-4">
        <Col xl={7}>
          <StatsRow stats={stats} isAdmin={isAdmin} />
        </Col>
        <Col xl={5}>
          <div className="surface chart-card h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="h6 heading-tight mb-0">Documents by {stats?.by_group?.field || "type"}</h2>
              <span className="pill pill-outline">{isAdmin ? "All divisions" : user.division}</span>
            </div>
            <Suspense fallback={chartPlaceholder}>
              <ReportChart group={stats?.by_group} loading={!stats} />
            </Suspense>
          </div>
        </Col>
      </Row>

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="chip-group" role="group" aria-label="Which documents to show">
          <button
            type="button"
            className={`chip ${scope === "division" ? "active" : ""}`}
            aria-pressed={scope === "division"}
            onClick={() => setScope("division")}
          >
            <Building2 size={16} aria-hidden="true" />
            My Division
          </button>
          <button
            type="button"
            className={`chip ${scope === "all" ? "active" : ""}`}
            aria-pressed={scope === "all"}
            onClick={() => setScope("all")}
          >
            <Globe size={16} aria-hidden="true" />
            All Divisions
          </button>
        </div>
        {!loading && (
          <span className="pill pill-outline">
            {result.total} {result.total === 1 ? "document" : "documents"}
          </span>
        )}
      </div>

      {fieldsError && <Alert variant="danger">Couldn&apos;t load metadata fields: {errorInfo(fieldsError).message}</Alert>}
      <FilterBar fields={fields} values={filterValues} onChange={setFilter} onClear={clearFilters} loading={fieldsLoading} />

      <div className="surface overflow-hidden">
        {error ? (
          <EmptyState
            Icon={AlertTriangle}
            title="Couldn't load documents"
            message={error}
            action={
              <Button variant="light" onClick={loadDocuments}>
                Try again
              </Button>
            }
          />
        ) : !loading && result.documents.length === 0 ? (
          <EmptyState
            Icon={hasFilters ? Filter : FolderOpen}
            title={hasFilters ? "No documents match these filters" : "No documents yet"}
            message={
              hasFilters
                ? "Remove a filter or switch to All Divisions."
                : "Upload the first document for your division. Scanned PDFs and images are read with OCR automatically."
            }
            action={
              hasFilters ? (
                <Button variant="light" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                uploadButton
              )
            }
          />
        ) : (
          <>
            <DocumentsTable documents={result.documents} fields={fields} loading={loading || fieldsLoading} />
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

      <UploadModal show={showUpload} fields={fields} onHide={() => setShowUpload(false)} onUploaded={afterUpload} />
    </>
  );
}
