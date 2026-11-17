import { Buildings, Warning } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { approveRequest, rejectRequest, requestAccess, revokeRequest } from "@/api/access";
import { errorInfo } from "@/api/client";
import { notifyAccessChanged } from "@/hooks/usePendingCount";
import { formatDate, timeAgo } from "@/utils/format";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";
import { Textarea } from "./ui/input";
import { Field } from "./ui/label";
import { SegmentedControl } from "./ui/segmented";

// Matches the API's note and reason limit.
const NOTE_MAX = 1000;
const NO_EXPIRY = "none";
const EXPIRY_OPTIONS = [
  { value: NO_EXPIRY, label: "No expiry" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

/** ISO date `days` from now, for previewing when an approval would end. */
export function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** "Access until 24 Nov 2026" or "No expiry" for an approved request. */
export function expiryLabel(expiresAt) {
  return expiresAt ? `Access until ${formatDate(expiresAt)}` : "No expiry";
}

function FormError({ message }) {
  if (!message) {
    return null;
  }
  return (
    <p className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-ink" role="alert">
      <Warning className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
      {message}
    </p>
  );
}

/** Optional note box with its hint and a character count on one line underneath. */
function NoteField({ id, label, hint, value, onChange, placeholder }) {
  return (
    <Field label={label} htmlFor={id}>
      <Textarea
        id={id}
        value={value}
        maxLength={NOTE_MAX}
        placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted">
        <span id={`${id}-hint`}>{hint}</span>
        <span className="tabular-nums" aria-hidden="true">
          {value.length}/{NOTE_MAX}
        </span>
      </div>
    </Field>
  );
}

function DialogFooter({ busy, submitLabel, busyLabel, onCancel }) {
  return (
    <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
      <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      <Button type="submit" disabled={busy}>
        {busy ? busyLabel : submitLabel}
      </Button>
    </div>
  );
}

/** Shared state for the dialogs below: a note, a busy flag and an error, all reset on open. */
function useDialogForm(open) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setNote("");
      setBusy(false);
      setError("");
    }
  }, [open]);
  return { note, setNote, busy, setBusy, error, setError };
}

/** Ask the owning division for access to one document. */
export function RequestAccessDialog({ document, open, onOpenChange, onRequested }) {
  const form = useDialogForm(open);

  const submit = async (event) => {
    event.preventDefault();
    form.setBusy(true);
    form.setError("");
    try {
      const response = await requestAccess(document.id, form.note.trim() || undefined);
      toast.success("Request sent", { description: `${document.division} will review it. Their decision shows in Access requests.` });
      onOpenChange(false);
      onRequested(response.data);
    } catch (error) {
      const info = errorInfo(error);
      // Someone (or another tab) already changed the state; show the current one instead of an error.
      if (info.code === "request_pending" || info.code === "already_has_access") {
        toast(info.message);
        onOpenChange(false);
        onRequested();
        return;
      }
      form.setError(info.message);
      form.setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !form.busy && onOpenChange(next)}>
      <DialogContent title="Request access" description={document.title} closable={!form.busy}>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <FormError message={form.error} />
            <div className="flex items-start gap-3 rounded-xl bg-lavender p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-primary">
                <Buildings className="size-5" aria-hidden="true" />
              </span>
              <div className="text-sm leading-6">
                <p className="font-semibold">Reviewed by {document.division}</p>
                <p className="text-muted">Anyone in that division can approve or reject it. You can open the file as soon as it is approved.</p>
              </div>
            </div>
            <NoteField
              id="access-reason"
              label="Reason (optional)"
              hint="A short reason helps the reviewer decide."
              placeholder="For example: needed for the joint logistics review"
              value={form.note}
              onChange={form.setNote}
            />
          </div>
          <DialogFooter busy={form.busy} submitLabel="Send request" busyLabel="Sending" onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Who asked, when, and why: shown at the top of every decision dialog. */
function RequestSummary({ request }) {
  return (
    <div className="rounded-xl bg-lavender p-4 text-sm leading-6">
      <p>
        <span className="font-semibold">{request.requester_name}</span>
        <span className="text-muted">
          {" "}
          from {request.requester_division} · {timeAgo(request.created_at)}
        </span>
      </p>
      <p className="mt-1 text-pretty text-muted">{request.reason ? `“${request.reason}”` : "No reason given."}</p>
    </div>
  );
}

const DECISIONS = {
  approve: {
    title: "Approve access",
    submit: "Approve",
    busy: "Approving",
    noteLabel: "Note for the requester (optional)",
    send: (request, note, days) => approveRequest(request.id, days, note),
    done: (request, updated) =>
      updated.expires_at
        ? [`Access approved for ${request.requester_name} until ${formatDate(updated.expires_at)}`]
        : [`Access approved for ${request.requester_name}`, "No expiry. Revoke it any time from Access requests."],
  },
  reject: {
    title: "Reject request",
    submit: "Reject",
    busy: "Rejecting",
    noteLabel: "Reason (optional)",
    hint: "The requester sees this note.",
    send: (request, note) => rejectRequest(request.id, note),
    done: (request) => ["Request rejected", `${request.requester_name} can ask again later if needed.`],
  },
  revoke: {
    title: "Revoke access",
    submit: "Revoke access",
    busy: "Revoking",
    noteLabel: "Reason (optional)",
    hint: "The requester sees this note.",
    send: (request, note) => revokeRequest(request.id, note),
    done: (request) => ["Access revoked", `${request.requester_name} can no longer open ${request.document_title}.`],
  },
};

/**
 * Approve, reject or revoke one access request. Approving offers an expiry of none, 7, 30 or 90 days.
 * `onDone` runs after any change, including when someone else decided first.
 *
 * With `onOptimistic({ action, request, days, note })`, the dialog closes at once and the caller
 * shows the change straight away; it returns a function that undoes the change if the API refuses.
 */
export function AccessDecisionDialog({ action, request, open, onOpenChange, onDone, onOptimistic }) {
  const form = useDialogForm(open);
  const [expiry, setExpiry] = useState(NO_EXPIRY);
  const config = DECISIONS[action] || DECISIONS.approve;

  useEffect(() => {
    if (open) {
      setExpiry(NO_EXPIRY);
    }
  }, [open]);

  if (!request) {
    return null;
  }

  const days = expiry === NO_EXPIRY ? null : Number(expiry);

  const submitOptimistically = async (note) => {
    const undo = onOptimistic({ action, request, days, note });
    // Deciding a pending request clears it from the queue, so the sidebar badge drops now too.
    const clearsPending = request.status === "pending";
    if (clearsPending) {
      notifyAccessChanged(-1);
    }
    onOpenChange(false);
    try {
      const response = await config.send(request, note, days);
      const [title, description] = config.done(request, response.data);
      toast.success(title, { description });
      onDone(response.data);
    } catch (error) {
      undo();
      const info = errorInfo(error);
      if (info.status === 409) {
        toast(info.message);
        onDone();
      } else {
        toast.error(info.message);
      }
    } finally {
      notifyAccessChanged();
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (onOptimistic) {
      submitOptimistically(form.note.trim() || undefined);
      return;
    }
    form.setBusy(true);
    form.setError("");
    try {
      const response = await config.send(request, form.note.trim() || undefined, days);
      const [title, description] = config.done(request, response.data);
      toast.success(title, { description });
      notifyAccessChanged();
      onOpenChange(false);
      onDone(response.data);
    } catch (error) {
      const info = errorInfo(error);
      // Another reviewer got there first: say so and show the latest state.
      if (info.status === 409) {
        toast(info.message);
        notifyAccessChanged();
        onOpenChange(false);
        onDone();
        return;
      }
      form.setError(info.message);
      form.setBusy(false);
    }
  };

  const description =
    action === "revoke"
      ? `${request.requester_name} loses access to ${request.document_title} straight away.`
      : request.document_title;

  return (
    <Dialog open={open} onOpenChange={(next) => !form.busy && onOpenChange(next)}>
      <DialogContent title={config.title} description={description} closable={!form.busy}>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <FormError message={form.error} />
            <RequestSummary request={request} />
            {action === "approve" && (
              <div>
                <p className="mb-1.5 text-sm font-medium" aria-hidden="true">
                  Access lasts
                </p>
                <SegmentedControl
                  options={EXPIRY_OPTIONS}
                  value={expiry}
                  onChange={setExpiry}
                  label="Access lasts"
                  className="flex w-full [&>button]:flex-1 [&>button]:px-2"
                />
                <p className="mt-1.5 text-xs text-muted" aria-live="polite">
                  {days ? `Access until ${formatDate(daysFromNow(days))}.` : "Access stays open until someone revokes it."}
                </p>
              </div>
            )}
            <NoteField
              id={`decision-note-${action}`}
              label={config.noteLabel}
              hint={config.hint}
              value={form.note}
              onChange={form.setNote}
            />
          </div>
          <DialogFooter busy={form.busy} submitLabel={config.submit} busyLabel={config.busy} onCancel={() => onOpenChange(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
