import { Inbox } from "lucide-react";

/** Friendly placeholder for lists with nothing to show. `Icon` is a lucide icon component. */
export default function EmptyState({ Icon = Inbox, code, title, message, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-line bg-lavender text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      {code && <span className="label-mono mb-2 text-muted">{code}</span>}
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {message && <p className="mt-1.5 max-w-md text-sm text-muted">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
