import { Warning } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { errorInfo } from "@/api/client";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";

/**
 * A short "are you sure" dialog. `onConfirm` may be async; if it throws, the API's message is
 * shown inside the dialog and it stays open. Without `onConfirm` it is a plain notice with a Close button.
 */
export default function ConfirmDialog({ open, onOpenChange, title, description, children, confirmLabel, busyLabel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setBusy(false);
      setError("");
    }
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(errorInfo(err).message);
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent title={title} description={description} closable={!busy}>
        {(children || error) && (
          <div className="space-y-4 px-6 pt-4">
            {error && (
              <p className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-ink" role="alert">
                <Warning className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                {error}
              </p>
            )}
            {children}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2 border-t border-line px-6 py-4">
          {onConfirm ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={confirm} disabled={busy}>
                {busy ? busyLabel || "Saving" : confirmLabel}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
