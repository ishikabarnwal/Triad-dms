import { LockKey } from "@phosphor-icons/react";
import { useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import AuditTab from "@/components/settings/AuditTab";
import DivisionsTab from "@/components/settings/DivisionsTab";
import FieldsTab from "@/components/settings/FieldsTab";
import UsersTab from "@/components/settings/UsersTab";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import useDocumentTitle from "@/hooks/useDocumentTitle";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "fields", label: "Metadata fields" },
  { value: "divisions", label: "Divisions" },
  { value: "users", label: "Users" },
  { value: "audit", label: "Audit log" },
];

/** Shown to members who reach /settings by link or typing the address. */
function NoAccess() {
  return (
    <div className="card mx-auto mt-6 max-w-xl">
      <EmptyState
        Icon={LockKey}
        title="You need admin access"
        message="Settings are managed by the system administrator. Ask them if a field, division or account needs to change."
        action={
          <Button asChild variant="outline">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}

function Tabs({ tab, onChange }) {
  return (
    <div role="tablist" aria-label="Settings sections" className="mb-6 flex gap-6 overflow-x-auto border-b border-line">
      {TABS.map((item) => {
        const selected = item.value === tab;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`settings-tab-${item.value}`}
            aria-selected={selected}
            aria-controls="settings-panel"
            onClick={() => onChange(item.value)}
            className={cn(
              "-mb-px shrink-0 cursor-pointer border-b-2 pb-3 text-sm font-semibold whitespace-nowrap transition-colors",
              selected ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  useDocumentTitle("Settings");
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((item) => item.value === params.get("tab")) ? params.get("tab") : "fields";

  /** Change some URL params, keeping the rest; empty values are removed. */
  const update = useCallback(
    (changes) =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
        return next;
      }),
    [setParams],
  );

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Settings" />
        <NoAccess />
      </>
    );
  }

  // Each tab has its own filters, so switching tabs starts from a clean URL.
  const setTab = (value) => setParams(value === "fields" ? {} : { tab: value });

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage the fields, divisions and people in this workspace." />
      <Tabs tab={tab} onChange={setTab} />
      <section id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}>
        {tab === "fields" && <FieldsTab />}
        {tab === "divisions" && <DivisionsTab />}
        {tab === "users" && <UsersTab params={params} update={update} />}
        {tab === "audit" && <AuditTab params={params} update={update} />}
      </section>
    </>
  );
}
