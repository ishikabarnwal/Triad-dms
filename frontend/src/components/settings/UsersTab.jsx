import { Users, Warning } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { listUsers, updateUser } from "@/api/admin";
import { errorInfo } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { useDivisionNames } from "@/hooks/useDivisions";
import { cn } from "@/lib/utils";
import { formatDate, initials, NOT_SET } from "@/utils/format";
import ConfirmDialog from "../ConfirmDialog";
import EmptyState from "../EmptyState";
import PaginationBar from "../PaginationBar";
import { Button } from "../ui/button";
import { NativeSelect } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { Tooltip } from "../ui/tooltip";
import DebouncedSearch from "./DebouncedSearch";

const PAGE_SIZE = 25;
const ROLE_LABELS = { member: "Member", admin: "Admin" };

/** What the confirm dialog says for a division or role change. */
function describeChange(change) {
  if (!change) {
    return {};
  }
  const { person, name, value } = change;
  if (name === "division") {
    return {
      title: `Move ${person.name} to ${value}?`,
      body: `${person.name} will see ${value}'s documents instead of ${person.division}'s. Files shared through approved requests stay open to them.`,
      confirm: "Move",
    };
  }
  if (value === "admin") {
    return {
      title: `Make ${person.name} an admin?`,
      body: "Admins can open every division's files, decide any access request and change these settings.",
      confirm: "Make admin",
    };
  }
  return {
    title: `Change ${person.name} to member?`,
    body: `${person.name} keeps ${person.division}'s documents but loses settings and access to other divisions' files.`,
    confirm: "Change to member",
  };
}

/** People in the workspace: find them, and change their division or role (with a confirm step). */
export default function UsersTab({ params, update }) {
  const { user } = useAuth();
  const divisions = useDivisionNames();
  const [state, setState] = useState({ users: [], total: 0, pages: 0, loading: true, error: "" });
  const [change, setChange] = useState(null);

  const q = params.get("q") || "";
  const division = params.get("division") || "";
  const role = params.get("role") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const load = useCallback(() => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    const query = { page, limit: PAGE_SIZE, ...(q && { q }), ...(division && { division }), ...(role && { role }) };
    listUsers(query)
      .then((response) => {
        const { users, total, pages } = response.data;
        setState({ users, total, pages, loading: false, error: "" });
      })
      .catch((error) => setState({ users: [], total: 0, pages: 0, loading: false, error: errorInfo(error).message }));
  }, [q, division, role, page]);

  useEffect(load, [load]);

  const setSearch = useCallback((text) => update({ q: text, page: null }), [update]);
  const filtered = Boolean(q || division || role);
  const copy = describeChange(change);

  /** Show the change in the table at once; put it back if the API refuses. */
  const confirmChange = async () => {
    const { person, name, value } = change;
    const replace = (next) => setState((current) => ({ ...current, users: current.users.map((item) => (item.id === person.id ? next : item)) }));
    replace({ ...person, [name]: value });
    try {
      const response = await updateUser(person.id, { [name]: value });
      replace(response.data);
      toast.success(name === "division" ? `${person.name} moved to ${value}` : `${person.name} is now ${ROLE_LABELS[value].toLowerCase()}`);
    } catch (error) {
      replace(person);
      throw error;
    }
  };

  let rows;
  if (state.loading) {
    rows = [0, 1, 2, 3, 4].map((row) => (
      <tr key={row} className="border-b border-line last:border-0" aria-hidden="true">
        <td className="h-16 px-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
        </td>
        {[20, 36, 28, 20].map((width, index) => (
          <td key={index} className="px-4">
            <Skeleton className="h-4" style={{ width: `${width * 4}px` }} />
          </td>
        ))}
      </tr>
    ));
  } else {
    rows = state.users.map((person) => {
      const self = person.id === user.id;
      const roleSelect = (
        <NativeSelect
          value={person.role}
          disabled={self}
          aria-label={`Role for ${person.name}`}
          onChange={(event) => setChange({ person, name: "role", value: event.target.value })}
          className="h-9 min-w-32"
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      );
      return (
        <tr key={person.id} className="border-b border-line last:border-0">
          <td className="px-5 py-3">
            <div className="flex min-w-56 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary" aria-hidden="true">
                {initials(person.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {person.name}
                  {self && <span className="ml-1.5 text-xs font-medium text-muted">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted">{person.email}</p>
              </div>
            </div>
          </td>
          <td className={cn("px-4 whitespace-nowrap", !person.username && "text-muted")}>{person.username || NOT_SET}</td>
          <td className="px-4">
            <NativeSelect
              value={person.division}
              aria-label={`Division for ${person.name}`}
              onChange={(event) => setChange({ person, name: "division", value: event.target.value })}
              className="h-9 min-w-40"
            >
              {/* A renamed or deleted division still shows until the person is moved. */}
              {!divisions.includes(person.division) && <option value={person.division}>{person.division}</option>}
              {divisions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </td>
          <td className="px-4">
            {self ? (
              <Tooltip content="You can't remove your own admin role. Another admin can.">
                <span tabIndex={0} className="inline-block rounded-lg">
                  {roleSelect}
                </span>
              </Tooltip>
            ) : (
              roleSelect
            )}
          </td>
          <td className="px-4 whitespace-nowrap text-muted">{formatDate(person.created_at)}</td>
        </tr>
      );
    });
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <DebouncedSearch value={q} onChange={setSearch} label="Search users" placeholder="Search name, email or username" />
        <NativeSelect
          value={division}
          onChange={(event) => update({ division: event.target.value, page: null })}
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
        <NativeSelect
          value={role}
          onChange={(event) => update({ role: event.target.value, page: null })}
          aria-label="Role"
          className={cn("h-10 w-full sm:w-auto sm:min-w-36", role && "border-primary/50 text-primary")}
        >
          <option value="">Any role</option>
          <option value="member">Members</option>
          <option value="admin">Admins</option>
        </NativeSelect>
        {filtered && (
          <button type="button" onClick={() => update({ q: null, division: null, role: null, page: null })} className="cursor-pointer px-2 text-sm font-semibold text-primary hover:underline">
            Clear filters
          </button>
        )}
      </div>

      <section className="card overflow-hidden" aria-label="Users">
        {state.error ? (
          <EmptyState
            Icon={Warning}
            title="Couldn't load users"
            message={state.error}
            action={
              <Button variant="outline" onClick={load}>
                Try again
              </Button>
            }
          />
        ) : !state.loading && state.users.length === 0 ? (
          <EmptyState
            Icon={Users}
            title={filtered ? "No one matches these filters" : "No users yet"}
            message={filtered ? "Try a shorter search or clear the filters." : "People appear here once they sign up."}
          />
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-lavender/50 text-left text-xs font-semibold text-muted">
                    <th scope="col" className="h-11 px-5">Person</th>
                    <th scope="col" className="h-11 px-4">Username</th>
                    <th scope="col" className="h-11 px-4">Division</th>
                    <th scope="col" className="h-11 px-4">Role</th>
                    <th scope="col" className="h-11 px-4">Joined</th>
                  </tr>
                </thead>
                <tbody>{rows}</tbody>
              </table>
            </div>
            {!state.loading && (
              <PaginationBar page={page} pages={state.pages} total={state.total} limit={PAGE_SIZE} onChange={(next) => update({ page: next === 1 ? null : String(next) })} />
            )}
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(change)}
        onOpenChange={(open) => !open && setChange(null)}
        title={copy.title || "Confirm change"}
        confirmLabel={copy.confirm}
        busyLabel="Saving"
        onConfirm={confirmChange}
      >
        {copy.body && <p className="text-sm leading-6 text-muted">{copy.body}</p>}
      </ConfirmDialog>
    </>
  );
}
