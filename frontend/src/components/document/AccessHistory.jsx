import { Warning } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { getInbox } from "@/api/access";
import { errorInfo } from "@/api/client";
import { formatDate, initials, timeAgo } from "@/utils/format";
import { AccessDecisionDialog, expiryLabel } from "../AccessDialogs";
import { RequestStatusChip } from "../Chips";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { SideCard } from "./SideCards";

// One document rarely has more requests than this; the full list lives on the access page.
const HISTORY_LIMIT = 50;

/** The line under a request that says what happened to it. */
function outcome(request) {
  switch (request.status) {
    case "approved":
      return `${expiryLabel(request.expires_at)} · approved by ${request.decided_by_name}`;
    case "expired":
      return `Ended ${formatDate(request.expires_at)}`;
    case "rejected":
      return `Rejected by ${request.decided_by_name} · ${timeAgo(request.decided_at)}`;
    case "revoked":
      return `Revoked by ${request.revoked_by_name} · ${timeAgo(request.revoked_at)}`;
    default:
      return null;
  }
}

function HistoryRow({ request, onDecide }) {
  const result = outcome(request);
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary" aria-hidden="true">
          {initials(request.requester_name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold">{request.requester_name}</p>
            <RequestStatusChip status={request.status} />
          </div>
          <p className="text-xs text-muted">
            {request.requester_division} · {timeAgo(request.created_at)}
          </p>
          {request.reason && <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-pretty text-muted">“{request.reason}”</p>}
          {result && <p className="mt-1.5 text-xs font-medium">{result}</p>}

          {request.status === "pending" && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => onDecide("approve", request)}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDecide("reject", request)}>
                Reject
              </Button>
            </div>
          )}
          {request.status === "approved" && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => onDecide("revoke", request)}>
              Revoke access
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/** Every request for one document, for the owning division: who asked, when, and what was decided. */
export default function AccessHistory({ document }) {
  const [state, setState] = useState({ requests: [], loading: true, error: "" });
  const [decision, setDecision] = useState({ action: null, request: null });

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: current.requests.length === 0, error: "" }));
    getInbox({ status: "all", doc_id: document.id, limit: HISTORY_LIMIT })
      .then((response) => setState({ requests: response.data.requests, loading: false, error: "" }))
      .catch((error) => setState({ requests: [], loading: false, error: errorInfo(error).message }));
  }, [document.id]);

  useEffect(load, [load]);

  const pending = state.requests.filter((request) => request.status === "pending").length;

  let body;
  if (state.loading) {
    body = (
      <div className="space-y-4" aria-hidden="true">
        {[0, 1].map((row) => (
          <div key={row} className="flex gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (state.error) {
    body = (
      <div className="flex items-start gap-2 text-sm" role="alert">
        <Warning className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
        <div>
          <p>{state.error}</p>
          <Button variant="link" size="sm" className="h-auto" onClick={load}>
            Try again
          </Button>
        </div>
      </div>
    );
  } else if (state.requests.length === 0) {
    body = (
      <p className="rounded-xl bg-lavender p-4 text-sm leading-6 text-muted">
        No one outside {document.division} has asked for this file yet. Requests will appear here for review.
      </p>
    );
  } else {
    body = (
      <ul className="divide-y divide-line">
        {state.requests.map((request) => (
          <HistoryRow key={request.id} request={request} onDecide={(action, item) => setDecision({ action, request: item })} />
        ))}
      </ul>
    );
  }

  return (
    <SideCard
      title="Access history"
      labelledBy="history-title"
      aside={pending > 0 && <span className="text-xs font-semibold text-primary">{pending} waiting</span>}
    >
      {body}
      <AccessDecisionDialog
        action={decision.action}
        request={decision.request}
        open={Boolean(decision.request)}
        onOpenChange={(open) => !open && setDecision((current) => ({ ...current, request: null }))}
        onDone={load}
      />
    </SideCard>
  );
}
