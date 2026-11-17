import { Copy, DownloadSimple, EyeSlash, LinkSimple, Scan, Warning } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";
import { fileTypeLabels } from "@/lib/limits";
import { formatBytes, formatDate, NOT_SET } from "@/utils/format";
import { expiryLabel } from "../AccessDialogs";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";

/** White card with a title row; `aside` sits on the right of the title. */
export function SideCard({ title, aside, children, labelledBy }) {
  return (
    <section aria-labelledby={labelledBy} className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={labelledBy} className="text-base font-bold tracking-[-0.02em]">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Copy text to the clipboard and say how it went. */
async function copyToClipboard(text, success) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(success);
  } catch {
    toast.error("Couldn't copy. Your browser blocked clipboard access.");
  }
}

/** Headline and one line about what the viewer can do with this file. */
function accessSummary(document) {
  const request = document.access_request;
  switch (document.access_status) {
    case "owner":
      return ["Your division's file", `Everyone in ${document.division} can open it.`];
    case "admin":
      return ["Administrator access", "You can open files from every division."];
    case "approved":
      return [expiryLabel(request?.expires_at), `Approved by ${request?.decided_by_name || document.division}.`];
    case "pending":
      return ["Request pending", `Waiting for ${document.division} to review.`];
    case "rejected":
      return ["Request declined", "You can ask again from the panel on this page."];
    case "expired":
      return ["Access ended", `It ended on ${formatDate(request?.expires_at)}.`];
    case "revoked":
      return ["Access revoked", "You can ask again from the panel on this page."];
    default:
      return ["No access yet", `Only ${document.division} and approved readers can open it.`];
  }
}

/** The page's one dark block: what the viewer may do, with Download (when allowed) and Copy link. */
export function ActionsCard({ document, downloading, onDownload }) {
  const [headline, line] = accessSummary(document);
  const copyLink = () => copyToClipboard(`${window.location.origin}/documents/${document.id}`, "Link copied");

  return (
    <section aria-labelledby="actions-title" className="card-dark p-5">
      <h2 id="actions-title" className="text-sm text-white/65">
        Your access
      </h2>
      <p className="mt-1 text-lg font-bold tracking-[-0.02em] text-white">{headline}</p>
      <p className="mt-0.5 text-sm text-white/65">{line}</p>
      <div className="mt-5 grid gap-2">
        {document.can_download && (
          <Button variant="onDark" onClick={onDownload} disabled={downloading}>
            <DownloadSimple className="size-4" weight="bold" aria-hidden="true" />
            {downloading ? "Preparing download" : "Download"}
          </Button>
        )}
        <Button variant="ghostDark" onClick={copyLink}>
          <LinkSimple className="size-4" aria-hidden="true" />
          Copy link
        </Button>
      </div>
    </section>
  );
}

/** A metadata value formatted by its field type. */
function formatValue(field, value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (field?.type === "date") {
    return formatDate(value);
  }
  if (field?.type === "number" && typeof value === "number") {
    return value.toLocaleString("en-IN");
  }
  return Array.isArray(value) ? value.join(", ") : String(value);
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-muted">{label}</dt>
      <dd className={value ? "text-right text-sm font-semibold break-words" : "text-right text-sm text-muted/80"}>{value || NOT_SET}</dd>
    </div>
  );
}

/**
 * Every active metadata field in the admin's order, then any extra keys the file was uploaded
 * with, then the file's own facts.
 */
export function MetadataCard({ document, fields, loading }) {
  const known = new Set(fields.map((field) => field.key));
  const extras = Object.keys(document.metadata || {}).filter((key) => !known.has(key));
  const kind = fileTypeLabels([(document.filename.split(".").pop() || "").toLowerCase()])[0];

  return (
    <SideCard title="Details" labelledBy="details-title">
      {loading ? (
        <div className="space-y-4 py-1" aria-hidden="true">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="flex justify-between">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <dl className="divide-y divide-line">
          {fields.map((field) => (
            <DetailRow key={field.key} label={field.label} value={formatValue(field, document.metadata?.[field.key])} />
          ))}
          {extras.map((key) => (
            <DetailRow key={key} label={key} value={formatValue(null, document.metadata[key])} />
          ))}
        </dl>
      )}
      <dl className="mt-3 divide-y divide-line border-t border-line pt-1">
        <DetailRow label="File type" value={kind} />
        <DetailRow label="Size" value={formatBytes(document.size)} />
        {document.page_count > 0 && <DetailRow label="Pages" value={String(document.page_count)} />}
      </dl>
    </SideCard>
  );
}

/** Icon, title and one or two lines, for the states where there is no text to show. */
function TextNotice({ Icon, title, children }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-lavender p-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-muted">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 text-sm leading-6">
        <p className="font-semibold">{title}</p>
        <div className="text-muted">{children}</div>
      </div>
    </div>
  );
}

/** OCR text with a copy button, or a calm explanation of why there is none to show. */
export function ExtractedTextCard({ document }) {
  const [expanded, setExpanded] = useState(false);
  const text = document.ocr_text || "";
  const hasText = Boolean(document.can_download && document.ocr_status === "done" && text.trim());

  let body;
  if (!document.can_download) {
    body = (
      <TextNotice Icon={EyeSlash} title="Content hidden until access is approved">
        The words inside this file stay private to {document.division} and approved readers.
      </TextNotice>
    );
  } else if (document.ocr_status === "failed") {
    body = (
      <TextNotice Icon={Warning} title="Text could not be read from this file">
        <p>The file is stored safely and can still be downloaded. Search finds it by its title and details, not by the words inside.</p>
        {document.ocr_error && <p className="mt-1.5 text-xs break-words">Reason: {document.ocr_error}</p>}
      </TextNotice>
    );
  } else if (document.ocr_status === "skipped") {
    body = (
      <TextNotice Icon={Scan} title="Text was not extracted">
        Text extraction was turned off when this file was uploaded.
      </TextNotice>
    );
  } else if (!hasText) {
    body = (
      <TextNotice Icon={Scan} title="No text found">
        The pages were read, but no words were found on them.
      </TextNotice>
    );
  } else {
    body = (
      <>
        <div
          tabIndex={0}
          aria-label="Extracted text"
          className={`overflow-y-auto rounded-xl border border-line bg-lavender/60 p-4 text-sm leading-6 break-words whitespace-pre-wrap focus-visible:outline-2 ${expanded ? "max-h-[70vh]" : "max-h-72"}`}
        >
          {text}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
          <span className="tabular-nums">{text.length.toLocaleString("en-IN")} characters</span>
          <button type="button" onClick={() => setExpanded((current) => !current)} className="cursor-pointer font-semibold text-primary hover:underline">
            {expanded ? "Show less" : "Show more"}
          </button>
        </div>
      </>
    );
  }

  return (
    <SideCard
      title="Extracted text"
      labelledBy="text-title"
      aside={
        hasText && (
          <Button variant="outline" size="sm" onClick={() => copyToClipboard(text, "Text copied")}>
            <Copy className="size-4" aria-hidden="true" />
            Copy text
          </Button>
        )
      }
    >
      {body}
    </SideCard>
  );
}
