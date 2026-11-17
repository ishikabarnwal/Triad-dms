import { ArrowCounterClockwise, CheckCircle, ClockCounterClockwise, Key, UploadSimple, XCircle } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import useDivisionCodes from "@/hooks/useDivisions";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/utils/format";
import EmptyState from "./EmptyState";
import { Skeleton } from "./ui/skeleton";

// How each kind of event from /api/stats `recent_activity` reads. Endings are muted, approvals are indigo.
const KINDS = {
  upload: { Icon: UploadSimple, verb: "uploaded", tone: "primary" },
  requested: { Icon: Key, verb: "asked for", tone: "primary" },
  approved: { Icon: CheckCircle, verb: "approved access to", tone: "primary" },
  rejected: { Icon: XCircle, verb: "rejected access to", tone: "muted" },
  revoked: { Icon: ArrowCounterClockwise, verb: "revoked access to", tone: "muted" },
};

function ActivityRow({ event, code }) {
  const kind = KINDS[event.kind] || KINDS.upload;
  const { Icon } = kind;
  return (
    <li>
      <Link
        to={`/documents/${event.document_id}`}
        className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-lavender/70"
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            kind.tone === "primary" ? "bg-primary/10 text-primary" : "bg-lavender text-muted",
          )}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm leading-5">
            {/* Anonymous uploads (from the API test script) have no person behind them. */}
            <span className="font-semibold">{event.actor || "An anonymous upload"}</span>{" "}
            {event.actor ? `${kind.verb} ` : "added "}
            <span className="font-semibold">{event.document_title}</span>
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {code} · {timeAgo(event.at)}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** The last few uploads and access decisions the user can see, newest first. */
export default function RecentActivity({ events, loading }) {
  const codes = useDivisionCodes();
  if (loading) {
    return (
      <div className="space-y-4" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!events?.length) {
    return (
      <EmptyState
        Icon={ClockCounterClockwise}
        title="Nothing yet"
        message="Uploads and access decisions for your division will show up here."
      />
    );
  }
  return (
    <ol className="space-y-0.5">
      {events.map((event) => (
        <ActivityRow key={`${event.kind}-${event.document_id}-${event.at}`} event={event} code={codes[event.division] || event.division} />
      ))}
    </ol>
  );
}
