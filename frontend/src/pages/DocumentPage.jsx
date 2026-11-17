import { ArrowLeft, FileX, Warning } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { toast } from "sonner";
import { blobErrorInfo, errorInfo } from "@/api/client";
import { downloadDocument, getDocument } from "@/api/documents";
import { RequestAccessDialog } from "@/components/AccessDialogs";
import { DivisionChip, FileIcon, OcrChip } from "@/components/Chips";
import AccessHistory from "@/components/document/AccessHistory";
import DocumentPreview from "@/components/document/DocumentPreview";
import LockedPanel from "@/components/document/LockedPanel";
import { ActionsCard, ExtractedTextCard, MetadataCard } from "@/components/document/SideCards";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import useDocumentTitle from "@/hooks/useDocumentTitle";
import useMetadataFields from "@/hooks/useMetadataFields";
import { formatBytes, formatDate } from "@/utils/format";

// Where "back" goes, by the page the user came from. Anything else returns to the dashboard.
const BACK_LABELS = [
  ["/search", "Back to search"],
  ["/access", "Back to access requests"],
];

/** The page the user came from (with its filters), carried in router state by the links into this page. */
function useBackLink() {
  const from = useLocation().state?.from;
  const to = typeof from === "string" && from.startsWith("/") ? from : "/dashboard";
  const label = BACK_LABELS.find(([prefix]) => to.startsWith(prefix))?.[1] || "Back to dashboard";
  return { to, label };
}

/** Save a blob under the given filename. */
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Give the browser a moment to start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function uploaderLine(document) {
  const when = `Uploaded ${formatDate(document.created_at)}`;
  if (document.uploaded_by_name) {
    return `${when} by ${document.uploaded_by_name}`;
  }
  return document.upload_source === "anonymous" ? `${when} through the API` : when;
}

function Header({ document, back }) {
  return (
    <header className="mb-8">
      <BackLink back={back} />
      <div className="flex items-start gap-4">
        <FileIcon contentType={document.content_type} className="size-12 rounded-xl [&>svg]:size-6" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] break-words sm:text-[2rem]">{document.title}</h1>
          <p className="mt-1 truncate text-sm text-muted">
            {document.filename} · {formatBytes(document.size)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <DivisionChip name={document.division} />
            <OcrChip status={document.ocr_status} />
            <span className="text-sm text-muted">{uploaderLine(document)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function BackLink({ back }) {
  return (
    <Link
      to={back.to}
      className="mb-5 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-muted transition-colors hover:text-primary"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {back.label}
    </Link>
  );
}

function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading document">
      <Skeleton className="mb-6 h-4 w-36" />
      <div className="mb-8 flex items-start gap-4">
        <Skeleton className="size-12 rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-2/3 max-w-md" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-6 w-72" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-[60vh] min-h-[420px] rounded-2xl" />
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

/** Full page message for a missing document or a failed load. */
function PageMessage({ back, Icon, title, message, action }) {
  return (
    <>
      <BackLink back={back} />
      <div className="card">
        <EmptyState Icon={Icon} title={title} message={message} action={action} />
      </div>
    </>
  );
}

export default function DocumentPage() {
  const { id } = useParams();
  const back = useBackLink();
  const { fields, loading: fieldsLoading } = useMetadataFields();
  const [state, setState] = useState({ document: null, loading: true, error: null });
  const [requestOpen, setRequestOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const document = state.document;

  useDocumentTitle(document?.title || "Document");

  // `quiet` refreshes in place (after a request or decision) instead of flashing the skeleton.
  const load = useCallback(
    (quiet = false) => {
      if (!quiet) {
        setState({ document: null, loading: true, error: null });
      }
      getDocument(id)
        .then((response) => setState({ document: response.data, loading: false, error: null }))
        .catch((error) => setState((current) => ({ document: quiet ? current.document : null, loading: false, error: errorInfo(error) })));
    },
    [id],
  );

  useEffect(() => load(), [load]);

  const refresh = useCallback(() => load(true), [load]);

  const download = async () => {
    setDownloading(true);
    try {
      const response = await downloadDocument(document.id);
      saveBlob(response.data, document.filename);
      toast.success(`Downloading ${document.filename}`);
    } catch (error) {
      const info = await blobErrorInfo(error);
      toast.error(info.message);
      // Access may have expired or been revoked since the page loaded; show the current state.
      if (info.status === 403) {
        refresh();
      }
    } finally {
      setDownloading(false);
    }
  };

  if (state.loading) {
    return <PageSkeleton />;
  }

  if (!document) {
    const missing = state.error?.status === 404;
    return missing ? (
      <PageMessage
        back={back}
        Icon={FileX}
        title="Document not found"
        message="It may have been removed, or the link may be wrong. Check the address, or find it from the dashboard."
        action={
          <Button asChild variant="outline">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        }
      />
    ) : (
      <PageMessage
        back={back}
        Icon={Warning}
        title="Couldn't load this document"
        message={state.error?.message}
        action={
          <Button variant="outline" onClick={() => load()}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <>
      <Header document={document} back={back} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {document.can_download ? (
            <DocumentPreview document={document} onDownload={download} />
          ) : (
            <LockedPanel document={document} onRequest={() => setRequestOpen(true)} />
          )}
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Document information">
          <ActionsCard document={document} downloading={downloading} onDownload={download} />
          <MetadataCard document={document} fields={fields} loading={fieldsLoading} />
          <ExtractedTextCard document={document} />
          {document.can_manage_access && <AccessHistory document={document} />}
        </aside>
      </div>

      <RequestAccessDialog document={document} open={requestOpen} onOpenChange={setRequestOpen} onRequested={refresh} />
    </>
  );
}
