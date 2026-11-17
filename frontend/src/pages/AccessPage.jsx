import { CheckCircle, MagnifyingGlass, Tray, Warning } from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { getInbox, getMyRequests } from "@/api/access";
import { errorInfo } from "@/api/client";
import { AccessDecisionDialog, daysFromNow, RequestAccessDialog } from "@/components/AccessDialogs";
import { IncomingRow, INCOMING_COLUMNS, MINE_COLUMNS, MyRequestRow, RowSkeletons } from "@/components/access/RequestRows";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import PaginationBar from "@/components/PaginationBar";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { useAuth } from "@/context/AuthContext";
import { useDivisionNames } from "@/hooks/useDivisions";
import useDocumentTitle from "@/hooks/useDocumentTitle";
import usePendingCount from "@/hooks/usePendingCount";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const TABS = [
  { value: "incoming", label: "Incoming" },
  { value: "mine", label: "My requests" },
];
const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "revoked", label: "Revoked" },
  { value: "expired", label: "Expired" },
  { value: "all", label: "All" },
];
const DEFAULT_STATUS = { incoming: "pending", mine: "all" };
// Statuses from which the requester may ask again (the API refuses the rest).
const ASK_AGAIN = new Set(["rejected", "expired", "revoked"]);

const EMPTY = {
  incoming: {
    pending: ["No pending requests", "You're all caught up."],
    approved: ["No active approvals", "Approved requests show here until they expire or are revoked."],
    rejected: ["No rejected requests", "Requests you turn down show here with your note."],
    revoked: ["No revoked access", "Approvals you withdraw show here."],
    expired: ["No expired access", "Approvals that reached their end date show here."],
    all: ["No requests yet", "When someone from another division asks for one of your files, it shows here."],
  },
  mine: {
    pending: ["Nothing waiting", "None of your requests are waiting for a decision."],
    approved: ["No active access", "Files other divisions have opened to you show here."],
    rejected: ["No rejected requests", "Good news: nothing you asked for was turned down."],
    revoked: ["No revoked access", "Access that was withdrawn shows here."],
    expired: ["No expired access", "Access that reached its end date shows here."],
    all: ["You haven't asked for anything yet", "Find a file from another division in Search and request access to it."],
  },
};

/** Field changes for a decision made on this page, mirroring what the API will store. */
function decisionPatch({ action, days, note }, user) {
  const now = new Date().toISOString();
  if (action === "approve") {
    return { status: "approved", decided_by_name: user.name, decided_at: now, decision_note: note || null, expires_at: days ? daysFromNow(days) : null };
  }
  if (action === "reject") {
    return { status: "rejected", decided_by_name: user.name, decided_at: now, decision_note: note || null };
  }
  return { status: "revoked", revoked_by_name: user.name, revoked_at: now, revoke_note: note || null };
}

/** Request ids that are the newest one for their document, so "Request again" shows once per file. */
function newestPerDocument(requests) {
  const seen = new Set();
  const newest = new Set();
  requests.forEach((request) => {
    if (!seen.has(request.document_id)) {
      seen.add(request.document_id);
      newest.add(request.id);
    }
  });
  return newest;
}

function Tabs({ tab, pending, onChange }) {
  return (
    <div role="tablist" aria-label="Request lists" className="mb-5 flex gap-6 border-b border-line">
      {TABS.map((item) => {
        const selected = item.value === tab;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-selected={selected}
            aria-controls="requests-panel"
            onClick={() => onChange(item.value)}
            className={cn(
              "-mb-px flex cursor-pointer items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition-colors",
              selected ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {item.label}
            {item.value === "incoming" && pending > 0 && (
              <span className="rounded-md bg-primary px-1.5 py-0.5 text-xs leading-none text-white tabular-nums">
                {pending}
                <span className="sr-only"> pending</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ColumnHeaders({ tab }) {
  const labels = tab === "incoming" ? ["Requested by", "Document", "Reason", "Status"] : ["Document", "My reason", "Status", ""];
  return (
    <div
      aria-hidden="true"
      className={cn(
        "hidden h-11 items-center gap-6 border-b border-line bg-lavender/50 px-5 text-xs font-semibold text-muted lg:grid",
        tab === "incoming" ? INCOMING_COLUMNS : MINE_COLUMNS,
      )}
    >
      {labels.map((label, index) => (
        <span key={index} className={index === 3 ? "text-right" : undefined}>
          {label}
        </span>
      ))}
    </div>
  );
}

export default function AccessPage() {
  useDocumentTitle("Access requests");
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const pending = usePendingCount();
  const divisions = useDivisionNames();

  const tab = params.get("tab") === "mine" ? "mine" : "incoming";
  const status = STATUSES.some((item) => item.value === params.get("status")) ? params.get("status") : DEFAULT_STATUS[tab];
  const division = tab === "incoming" && isAdmin ? params.get("division") || "" : "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const from = `${location.pathname}${location.search}`;

  const [state, setState] = useState({ requests: [], total: 0, pages: 0, loading: true, error: "" });
  const [decision, setDecision] = useState({ action: null, request: null });
  const [askAgain, setAskAgain] = useState(null);

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    const fetchList = tab === "incoming" ? getInbox : getMyRequests;
    return fetchList({ status, page, limit: PAGE_SIZE, ...(division ? { division } : {}) })
      .then((response) => {
        const { requests, total, pages } = response.data;
        setState({ requests, total, pages, loading: false, error: "" });
      })
      .catch((error) => setState({ requests: [], total: 0, pages: 0, loading: false, error: errorInfo(error).message }));
  }, [tab, status, page, division]);

  useEffect(() => {
    load();
  }, [load]);

  /** Change URL params; anything that changes the list sends you back to page 1. */
  const update = (changes) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries({ page: null, ...changes }).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
      return next;
    });

  const setTab = (value) => update({ tab: value === "incoming" ? null : value, status: null, division: null });
  const setStatus = (value) => update({ status: value === DEFAULT_STATUS[tab] ? null : value });

  /** Show a decision at once; the returned function puts the list back if the API refuses it. */
  const applyOptimistic = (change) => {
    let before = null;
    setState((current) => {
      before = current;
      const updated = { ...change.request, ...decisionPatch(change, user) };
      const stays = status === "all" || status === updated.status;
      return {
        ...current,
        total: stays ? current.total : current.total - 1,
        requests: stays
          ? current.requests.map((item) => (item.id === updated.id ? updated : item))
          : current.requests.filter((item) => item.id !== updated.id),
      };
    });
    return () => before && setState(before);
  };

  /** Swap in the server's copy of a decided request, or reload when someone else decided first. */
  const afterDecision = (saved) => {
    if (!saved) {
      load();
      return;
    }
    setState((current) => ({ ...current, requests: current.requests.map((item) => (item.id === saved.id ? saved : item)) }));
  };

  const columns = tab === "incoming" ? INCOMING_COLUMNS : MINE_COLUMNS;
  const newest = newestPerDocument(state.requests);
  const [emptyTitle, emptyMessage] = EMPTY[tab][status];

  let list;
  if (state.error) {
    list = (
      <div className="card">
        <EmptyState
          Icon={Warning}
          title="Couldn't load requests"
          message={state.error}
          action={
            <Button variant="outline" onClick={load}>
              Try again
            </Button>
          }
        />
      </div>
    );
  } else if (!state.loading && state.requests.length === 0) {
    list = (
      <div className="card">
        <EmptyState
          Icon={tab === "incoming" && status === "pending" ? CheckCircle : Tray}
          title={emptyTitle}
          message={emptyMessage}
          action={
            tab === "mine" && status === "all" ? (
              <Button asChild variant="outline">
                <Link to="/search">
                  <MagnifyingGlass className="size-4" aria-hidden="true" />
                  Go to search
                </Link>
              </Button>
            ) : null
          }
        />
      </div>
    );
  } else {
    list = (
      <div className="lg:overflow-hidden lg:rounded-2xl lg:border lg:border-line lg:bg-white lg:shadow-soft">
        <ColumnHeaders tab={tab} />
        <ul className="space-y-3 lg:space-y-0 lg:divide-y lg:divide-line" aria-busy={state.loading}>
          {state.loading ? (
            <RowSkeletons columns={columns} />
          ) : (
            <AnimatePresence initial={false}>
              {state.requests.map((request) =>
                tab === "incoming" ? (
                  <IncomingRow key={request.id} request={request} from={from} onDecide={(action, item) => setDecision({ action, request: item })} />
                ) : (
                  <MyRequestRow
                    key={request.id}
                    request={request}
                    from={from}
                    canAskAgain={ASK_AGAIN.has(request.status) && newest.has(request.id)}
                    onAskAgain={setAskAgain}
                  />
                ),
              )}
            </AnimatePresence>
          )}
        </ul>
        {!state.loading && state.pages > 1 && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white lg:mt-0 lg:rounded-none lg:border-0">
            <PaginationBar page={page} pages={state.pages} total={state.total} limit={PAGE_SIZE} onChange={(next) => update({ page: next === 1 ? null : String(next) })} />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Access requests"
        subtitle={
          isAdmin
            ? "Review requests for every division's files, and follow the ones you sent."
            : `Review requests for ${user.division}'s files, and follow the ones you sent.`
        }
      />

      <Tabs tab={tab} pending={pending} onChange={setTab} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Six options don't fit a phone in one row, so they sit in a 3 by 2 grid there. */}
        <SegmentedControl
          options={STATUSES}
          value={status}
          onChange={setStatus}
          label="Filter by status"
          className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto"
        />
        {tab === "incoming" && isAdmin && (
          <NativeSelect
            value={division}
            onChange={(event) => update({ division: event.target.value })}
            aria-label="Division"
            className={cn("h-10 w-full sm:w-auto sm:min-w-44", division && "border-primary/50 text-primary")}
          >
            <option value="">All divisions</option>
            {divisions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </NativeSelect>
        )}
      </div>

      <section id="requests-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {list}
      </section>

      <AccessDecisionDialog
        action={decision.action}
        request={decision.request}
        open={Boolean(decision.request)}
        onOpenChange={(open) => !open && setDecision((current) => ({ ...current, request: null }))}
        onOptimistic={applyOptimistic}
        onDone={afterDecision}
      />

      {askAgain && (
        <RequestAccessDialog
          document={{ id: askAgain.document_id, title: askAgain.document_title, division: askAgain.owner_division }}
          open={Boolean(askAgain)}
          onOpenChange={(open) => !open && setAskAgain(null)}
          onRequested={load}
        />
      )}
    </>
  );
}
