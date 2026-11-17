import { Info, PencilSimple, Plus, Trash, Warning } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createDivision, deleteDivision, listDivisions, updateDivision } from "@/api/admin";
import { errorInfo, inputErrors } from "@/api/client";
import { invalidateDivisions } from "@/hooks/useDivisions";
import { invalidateMetadataFields } from "@/hooks/useMetadataFields";
import { formatDate } from "@/utils/format";
import { Chip } from "../Chips";
import ConfirmDialog from "../ConfirmDialog";
import EmptyState from "../EmptyState";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";
import { Input, Textarea } from "../ui/input";
import { Field } from "../ui/label";
import { Skeleton } from "../ui/skeleton";

const EMPTY = { name: "", code: "", description: "" };
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Add or edit a division. A rename carries through users, documents and requests, so the dialog says so. */
function DivisionDialog({ open, division, onOpenChange, onSaved }) {
  const editing = Boolean(division);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(division ? { name: division.name, code: division.code || "", description: division.description || "" } : EMPTY);
      setErrors({});
      setFormError("");
      setBusy(false);
    }
  }, [open, division]);

  const set = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setErrors({ name: "Give the division a name." });
      return;
    }
    setBusy(true);
    setFormError("");
    const body = { name: form.name.trim(), code: form.code.trim() || undefined, description: form.description.trim() || undefined };
    try {
      const response = editing ? await updateDivision(division.id, body) : await createDivision(body);
      onSaved(response.data, editing, division);
      onOpenChange(false);
    } catch (error) {
      const info = errorInfo(error);
      const placed = inputErrors(info);
      setErrors(placed);
      setFormError(Object.keys(placed).length ? "" : info.message);
      setBusy(false);
    }
  };

  const renaming = editing && form.name.trim() && form.name.trim() !== division.name;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        title={editing ? `Edit ${division.name}` : "Add division"}
        description={editing ? undefined : "It shows up on the sign up page and the upload form straight away."}
        closable={!busy}
      >
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {formError && (
              <p className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-ink" role="alert">
                <Warning className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                {formError}
              </p>
            )}
            {editing && (
              <p className="flex items-start gap-2 rounded-lg bg-lavender px-4 py-3 text-sm leading-6">
                <Info className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                {renaming
                  ? `Renaming updates every user, document and access request in ${division.name}. The audit log keeps the old name.`
                  : "A new name carries through to every user, document and access request in this division."}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
              <Field label="Name" htmlFor="division-name" required error={errors.name}>
                <Input id="division-name" value={form.name} maxLength={100} invalid={Boolean(errors.name)} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Code" htmlFor="division-code" error={errors.code} hint="Short, like DIV-C.">
                <Input
                  id="division-code"
                  value={form.code}
                  maxLength={20}
                  invalid={Boolean(errors.code)}
                  onChange={(e) => set("code", e.target.value.toUpperCase())}
                />
              </Field>
            </div>
            <Field label="Description" htmlFor="division-description" error={errors.description}>
              <Textarea
                id="division-description"
                value={form.description}
                maxLength={500}
                invalid={Boolean(errors.description)}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving" : editing ? "Save changes" : "Add division"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Divisions with their head counts; delete is only possible once a division is empty. */
export default function DivisionsTab() {
  const [divisions, setDivisions] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [dialog, setDialog] = useState({ open: false, division: null });
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => {
    setState({ loading: true, error: "" });
    listDivisions()
      .then((response) => {
        setDivisions(response.data.divisions);
        setState({ loading: false, error: "" });
      })
      .catch((error) => setState({ loading: false, error: errorInfo(error).message }));
  }, []);

  useEffect(load, [load]);

  /** Chips, filters and the division field's options all read the cached divisions. */
  const changed = () => {
    invalidateDivisions();
    invalidateMetadataFields();
  };

  const saved = (division, editing, before) => {
    setDivisions((current) =>
      (editing ? current.map((item) => (item.id === division.id ? division : item)) : [...current, division]).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    changed();
    if (editing && before.name !== division.name) {
      toast.success(`${before.name} is now ${division.name}`, { description: "Users, documents and requests moved with it." });
    } else {
      toast.success(editing ? `${division.name} saved` : `${division.name} added`);
    }
  };

  const remove = async () => {
    await deleteDivision(deleting.id);
    setDivisions((current) => current.filter((item) => item.id !== deleting.id));
    changed();
    toast.success(`${deleting.name} deleted`);
  };

  const blocked = deleting && (deleting.user_count > 0 || deleting.document_count > 0);

  let body;
  if (state.error) {
    body = (
      <EmptyState
        Icon={Warning}
        title="Couldn't load the divisions"
        message={state.error}
        action={
          <Button variant="outline" onClick={load}>
            Try again
          </Button>
        }
      />
    );
  } else {
    body = (
      <div className="relative overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-lavender/50 text-left text-xs font-semibold text-muted">
              <th scope="col" className="h-11 px-5">Name</th>
              <th scope="col" className="h-11 px-4">Code</th>
              <th scope="col" className="h-11 px-4">Description</th>
              <th scope="col" className="h-11 px-4 text-right">Users</th>
              <th scope="col" className="h-11 px-4 text-right">Documents</th>
              <th scope="col" className="h-11 px-4">Created</th>
              <th scope="col" className="h-11 px-5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {state.loading
              ? [0, 1, 2].map((row) => (
                  <tr key={row} className="border-b border-line last:border-0" aria-hidden="true">
                    {[32, 16, 48, 8, 8, 20, 16].map((width, index) => (
                      <td key={index} className="h-16 px-4 first:pl-5">
                        <Skeleton className="h-4" style={{ width: `${width * 4}px` }} />
                      </td>
                    ))}
                  </tr>
                ))
              : divisions.map((division) => (
                  <tr key={division.id} className="border-b border-line last:border-0">
                    <td className="h-16 px-5 font-semibold whitespace-nowrap">{division.name}</td>
                    <td className="px-4">{division.code ? <Chip tone="outline">{division.code}</Chip> : <span className="text-muted">Not set</span>}</td>
                    <td className="max-w-80 min-w-48 px-4 py-3 text-muted">{division.description || "No description"}</td>
                    <td className="px-4 text-right tabular-nums">{division.user_count}</td>
                    <td className="px-4 text-right tabular-nums">{division.document_count}</td>
                    <td className="px-4 whitespace-nowrap text-muted">{formatDate(division.created_at)}</td>
                    <td className="px-5">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="iconSm" onClick={() => setDialog({ open: true, division })} aria-label={`Edit ${division.name}`}>
                          <PencilSimple className="size-4" aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="iconSm" onClick={() => setDeleting(division)} aria-label={`Delete ${division.name}`}>
                          <Trash className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm leading-6 text-muted">
          Every user and document belongs to one division. People open their own division's files and request access to the rest.
        </p>
        <Button onClick={() => setDialog({ open: true, division: null })} disabled={state.loading || Boolean(state.error)}>
          <Plus className="size-4" weight="bold" aria-hidden="true" />
          Add division
        </Button>
      </div>

      <section className="card overflow-hidden" aria-label="Divisions">
        {body}
      </section>

      <DivisionDialog
        open={dialog.open}
        division={dialog.division}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        onSaved={saved}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? (blocked ? `${deleting.name} can't be deleted yet` : `Delete ${deleting.name}?`) : "Delete division"}
        description={blocked ? undefined : "It disappears from sign up and the upload form. This can't be undone."}
        confirmLabel="Delete division"
        busyLabel="Deleting"
        onConfirm={blocked ? undefined : remove}
      >
        {blocked && (
          <p className="rounded-xl bg-lavender p-4 text-sm leading-6">
            It still has {plural(deleting.user_count, "user")} and {plural(deleting.document_count, "document")}. Move the users to another division
            on the Users tab first. Divisions that hold documents stay, so those files always have an owner.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
