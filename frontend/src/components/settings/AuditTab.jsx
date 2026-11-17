import { CaretDown, ClockCounterClockwise, Warning } from "@phosphor-icons/react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { listAuditLogs } from "@/api/admin";
import { errorInfo } from "@/api/client";
import { useDivisionNames } from "@/hooks/useDivisions";
import { cn } from "@/lib/utils";
import { formatDateTime, timeAgo } from "@/utils/format";
import { Chip, DivisionChip } from "../Chips";
import EmptyState from "../EmptyState";
import PaginationBar from "../PaginationBar";
import { DateBox } from "../search/SearchFilters";
import { Button } from "../ui/button";
import { NativeSelect } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { Tooltip } from "../ui/tooltip";
import { ACTION_GROUPS, auditSentence, detailRows, failureLabel } from "./auditText";
import DebouncedSearch from "./DebouncedSearch";

const PAGE_SIZE = 25;
const COLUMNS = 4;

/** The sentence, with names in bold and documents as links to their page. */
function Sentence({ entry, from }) {
  return (
    <p className="leading-6 break-words">
      {auditSentence(entry).map((part, index) => {
        if (typeof part === "string") {
          return <Fragment key={index}>{part}</Fragment>;
        }
        if (part.doc) {
          return (
            <Link
              key={index}
              to={`/documents/${part.doc}`}
              state={{ from }}
              onClick={(event) => event.stopPropagation()}
              className="rounded-sm font-semibold text-primary hover:underline"
            >
              {part.title}
            </Link>
          );
        }
        return (
          <span key={index} className="font-semibold">
            {part.strong}
          </span>
        );
      })}
    </p>
  );
}

/** Everything the entry recorded, as plain label and value pairs. */
function EntryDetails({ entry }) {
  const rows = [
    { label: "IP address", value: entry.ip || "Not recorded" },
    { label: "Action", value: entry.action },
    { label: "Target", value: entry.target_type ? `${entry.target_type} ${entry.target_id || ""}`.trim() : "None" },
    { label: "Exact time", value: formatDateTime(entry.created_at) },
    ...detailRows(entry.details),
  ];
  return (
    <dl className="grid gap-x-8 gap-y-2 rounded-xl border border-line bg-white p-4 text-sm sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-0 gap-3">
          <dt className="w-32 shrink-0 text-muted">{row.label}</dt>
          <dd className="min-w-0 break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function EntryRow({ entry, open, onToggle, from }) {
  const failure = failureLabel(entry.action);
  return (
    <>
      <tr
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
        className={cn(
          "cursor-pointer border-b border-line align-top transition-colors hover:bg-lavender/60 focus-visible:bg-lavender focus-visible:outline-none",
          open && "bg-lavender/60",
        )}
      >
        <td className="px-5 py-3.5 whitespace-nowrap">
          <Tooltip content={formatDateTime(entry.created_at)}>
            <span className="rounded-sm text-muted">{timeAgo(entry.created_at)}</span>
          </Tooltip>
        </td>
        <td className="px-4 py-3.5">
          <div className="flex min-w-36 flex-col items-start gap-1">
            <span className={cn("font-semibold", !entry.actor_name && "text-muted")}>{entry.actor_name || "No signed in user"}</span>
            {entry.division && <DivisionChip name={entry.division} />}
          </div>
        </td>
        <td className="min-w-72 px-4 py-3.5">
          <Sentence entry={entry} from={from} />
        </td>
        <td className="px-5 py-3.5">
          <div className="flex items-center justify-end gap-2">
            {failure && (
              <Chip Icon={Warning} tone="danger">
                {failure}
              </Chip>
            )}
            <CaretDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-line bg-lavender/60">
          <td colSpan={COLUMNS} className="px-5 pb-4">
            <EntryDetails entry={entry} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Who did what and when, newest first, with filters kept in the URL. */
export default function AuditTab({ params, update }) {
  const location = useLocation();
  const divisions = useDivisionNames();
  const [state, setState] = useState({ logs: [], total: 0, pages: 0, loading: true, error: "" });
  const [openId, setOpenId] = useState(null);

  const group = params.get("action") || "";
  const actor = params.get("actor") || "";
  const division = params.get("division") || "";
  const dateFrom = params.get("date_from") || "";
  const dateTo = params.get("date_to") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const filtered = Boolean(group || actor || division || dateFrom || dateTo);
  const from = `${location.pathname}${location.search}`;

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    const prefixes = ACTION_GROUPS.find((item) => item.value === group)?.prefixes;
    const query = {
      page,
      limit: PAGE_SIZE,
      ...(prefixes && { action: prefixes }),
      ...(actor && { actor }),
      ...(division && { division }),
      ...(dateFrom && { date_from: dateFrom }),
      ...(dateTo && { date_to: dateTo }),
    };
    listAuditLogs(query)
      .then((response) => {
        const { logs, total, pages } = response.data;
        setState({ logs, total, pages, loading: false, error: "" });
      })
      .catch((error) => setState({ logs: [], total: 0, pages: 0, loading: false, error: errorInfo(error).message }));
  }, [group, actor, division, dateFrom, dateTo, page]);

  useEffect(load, [load]);

  const setFilter = useCallback((key, value) => update({ [key]: value, page: null }), [update]);
  const setActor = useCallback((value) => setFilter("actor", value), [setFilter]);

  let body;
  if (state.error) {
    body = (
      <EmptyState
        Icon={Warning}
        title="Couldn't load the audit log"
        message={state.error}
        action={
          <Button variant="outline" onClick={load}>
            Try again
          </Button>
        }
      />
    );
  } else if (!state.loading && state.logs.length === 0) {
    body = (
      <EmptyState
        Icon={ClockCounterClockwise}
        title={filtered ? "Nothing matches these filters" : "Nothing recorded yet"}
        message={filtered ? "Widen the dates or clear a filter." : "Sign ins, uploads, downloads, access decisions and admin changes appear here."}
      />
    );
  } else {
    body = (
      <>
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-lavender/50 text-left text-xs font-semibold text-muted">
                <th scope="col" className="h-11 px-5">When</th>
                <th scope="col" className="h-11 px-4">Who</th>
                <th scope="col" className="h-11 px-4">What happened</th>
                <th scope="col" className="h-11 px-5">
                  <span className="sr-only">Status and details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {state.loading
                ? [0, 1, 2, 3, 4, 5].map((row) => (
                    <tr key={row} className="border-b border-line last:border-0" aria-hidden="true">
                      <td className="h-16 px-5">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="px-4">
                        <Skeleton className="h-4 w-28" />
                      </td>
                      <td className="px-4">
                        <Skeleton className="h-4 w-80 max-w-full" />
                      </td>
                      <td className="px-5" />
                    </tr>
                  ))
                : state.logs.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      from={from}
                      open={openId === entry.id}
                      onToggle={() => setOpenId((current) => (current === entry.id ? null : entry.id))}
                    />
                  ))}
            </tbody>
          </table>
        </div>
        {!state.loading && (
          <PaginationBar page={page} pages={state.pages} total={state.total} limit={PAGE_SIZE} onChange={(next) => update({ page: next === 1 ? null : String(next) })} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        <NativeSelect
          value={group}
          onChange={(event) => setFilter("action", event.target.value)}
          aria-label="Action"
          className={cn("h-10 w-full sm:w-auto sm:min-w-44", group && "border-primary/50 text-primary")}
        >
          <option value="">All actions</option>
          {ACTION_GROUPS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </NativeSelect>
        <DebouncedSearch value={actor} onChange={setActor} label="Search by person" placeholder="Search by person" />
        <NativeSelect
          value={division}
          onChange={(event) => setFilter("division", event.target.value)}
          aria-label="Division"
          className={cn("h-10 w-full sm:w-auto sm:min-w-44", division && "border-primary/50 text-primary")}
        >
          <option value="">Any division</option>
          {divisions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </NativeSelect>
        <DateBox label="From" value={dateFrom} onChange={(value) => setFilter("date_from", value)} />
        <DateBox label="To" value={dateTo} onChange={(value) => setFilter("date_to", value)} />
        {filtered && (
          <button
            type="button"
            onClick={() => update({ action: null, actor: null, division: null, date_from: null, date_to: null, page: null })}
            className="cursor-pointer px-2 text-sm font-semibold text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <section className="card overflow-hidden" aria-label="Audit log">
        {body}
      </section>
    </>
  );
}
