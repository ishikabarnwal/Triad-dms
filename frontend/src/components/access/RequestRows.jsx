import { Key } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, initials, timeAgo } from "@/utils/format";
import { expiryLabel } from "../AccessDialogs";
import { DivisionChip, RequestStatusChip } from "../Chips";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";

// Column layouts for the wide screen table view; below lg each row is its own card.
export const INCOMING_COLUMNS = "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1.35fr)_200px]";
export const MINE_COLUMNS = "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_150px]";

const ROW =
  "rounded-2xl border border-line bg-white p-4 shadow-soft lg:grid lg:items-start lg:gap-6 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-5 lg:py-4 lg:shadow-none";

/** Rows fade out when a decision moves them out of the current filter. */
const rowMotion = {
  layout: "position",
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.25 },
};

/** What happened to a request, who did it and when, as one short line. Null while pending. */
export function decisionLine(request) {
  switch (request.status) {
    case "approved":
      return `Approved by ${request.decided_by_name} · ${timeAgo(request.decided_at)}`;
    case "expired":
      return `Approved by ${request.decided_by_name}, ended ${formatDate(request.expires_at)}`;
    case "rejected":
      return `Rejected by ${request.decided_by_name} · ${timeAgo(request.decided_at)}`;
    case "revoked":
      return `Revoked by ${request.revoked_by_name} · ${timeAgo(request.revoked_at)}`;
    default:
      return null;
  }
}

/** The note left with the decision, if any. */
export function decisionNote(request) {
  return request.status === "revoked" ? request.revoke_note : request.decision_note;
}

function Quote({ text, empty }) {
  return text ? (
    <p className="text-sm leading-6 text-pretty break-words">“{text}”</p>
  ) : (
    <p className="text-sm text-muted">{empty}</p>
  );
}

/** Small caption above each block, shown only in the stacked card layout. */
function MobileLabel({ children }) {
  return <p className="mb-1 text-xs font-semibold text-muted lg:hidden">{children}</p>;
}

function Decision({ request }) {
  const line = decisionLine(request);
  const note = decisionNote(request);
  if (!line) {
    return null;
  }
  return (
    <div className="mt-2.5 border-l-2 border-line pl-3">
      <p className="text-xs font-medium text-muted">{line}</p>
      {note && <p className="mt-0.5 text-sm leading-6 text-pretty break-words">{note}</p>}
    </div>
  );
}

function DocumentLink({ request, from }) {
  return (
    <Link
      to={`/documents/${request.document_id}`}
      state={{ from }}
      className="rounded-sm font-semibold break-words hover:text-primary"
    >
      {request.document_title}
    </Link>
  );
}

/** A request for one of my division's documents, with the decision buttons that fit its status. */
export function IncomingRow({ request, from, onDecide }) {
  return (
    <motion.li {...rowMotion} className={cn(ROW, INCOMING_COLUMNS, "space-y-4 lg:space-y-0")}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary" aria-hidden="true">
          {initials(request.requester_name)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{request.requester_name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <DivisionChip name={request.requester_division} />
            <span className="text-xs text-muted">{timeAgo(request.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <MobileLabel>Document</MobileLabel>
        <DocumentLink request={request} from={from} />
        <p className="mt-0.5 text-xs text-muted">Belongs to {request.owner_division}</p>
      </div>

      <div className="min-w-0">
        <MobileLabel>Reason</MobileLabel>
        <Quote text={request.reason} empty="No reason given" />
        <Decision request={request} />
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end lg:text-right">
        <RequestStatusChip status={request.status} />
        {request.status === "approved" && <p className="text-xs font-medium">{expiryLabel(request.expires_at)}</p>}
        {request.status === "pending" && (
          <div className="flex w-full gap-2 lg:justify-end">
            <Button size="sm" className="flex-1 lg:flex-none" onClick={() => onDecide("approve", request)}>
              Approve
            </Button>
            <Button size="sm" variant="outline" className="flex-1 lg:flex-none" onClick={() => onDecide("reject", request)}>
              Reject
            </Button>
          </div>
        )}
        {request.status === "approved" && (
          <Button size="sm" variant="outline" className="w-full lg:w-auto" onClick={() => onDecide("revoke", request)}>
            Revoke
          </Button>
        )}
      </div>
    </motion.li>
  );
}

/** The status in a sentence, from the requester's side. */
function myStatusDetail(request) {
  switch (request.status) {
    case "pending":
      return `Pending since ${formatDateTime(request.created_at)}`;
    case "approved":
      return expiryLabel(request.expires_at);
    case "expired":
      return `Ended on ${formatDate(request.expires_at)}`;
    case "rejected":
      return `Rejected by ${request.decided_by_name}`;
    case "revoked":
      return `Revoked by ${request.revoked_by_name}`;
    default:
      return null;
  }
}

/** A request I sent: where it stands, the reviewer's note, and "Request again" when that's allowed. */
export function MyRequestRow({ request, from, canAskAgain, onAskAgain }) {
  const note = decisionNote(request);
  return (
    <motion.li {...rowMotion} className={cn(ROW, MINE_COLUMNS, "space-y-4 lg:space-y-0")}>
      <div className="min-w-0">
        <DocumentLink request={request} from={from} />
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <DivisionChip name={request.owner_division} />
          <span className="text-xs text-muted">Requested {formatDate(request.created_at)}</span>
        </div>
      </div>

      <div className="min-w-0">
        <MobileLabel>My reason</MobileLabel>
        <Quote text={request.reason} empty="No reason given" />
      </div>

      <div className="min-w-0">
        <MobileLabel>Status</MobileLabel>
        <RequestStatusChip status={request.status} />
        <p className="mt-1.5 text-xs font-medium">{myStatusDetail(request)}</p>
        {note && <p className="mt-1 text-sm leading-6 text-pretty break-words text-muted">“{note}”</p>}
      </div>

      <div className="lg:text-right">
        {canAskAgain && (
          <Button size="sm" variant="outline" className="w-full lg:w-auto" onClick={() => onAskAgain(request)}>
            <Key className="size-4" aria-hidden="true" />
            Request again
          </Button>
        )}
      </div>
    </motion.li>
  );
}

/** Placeholder rows in the same shape as the real ones. */
export function RowSkeletons({ columns, count = 4 }) {
  return Array.from({ length: count }, (_, index) => (
    <li key={index} className={cn(ROW, columns, "space-y-3 lg:space-y-0")} aria-hidden="true">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-3.5 w-full max-w-60" />
      <div className="flex gap-2 lg:justify-end">
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </li>
  ));
}
