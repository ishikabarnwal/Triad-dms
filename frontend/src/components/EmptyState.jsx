import { Inbox } from "lucide-react";

/** Friendly placeholder for lists with nothing to show. `Icon` is a lucide icon component. */
export default function EmptyState({ Icon = Inbox, title, message, action }) {
  return (
    <div className="empty-state">
      <span className="icon-tile">
        <Icon size={26} aria-hidden="true" />
      </span>
      <h2 className="h5 heading-tight mb-2">{title}</h2>
      {message && (
        <p className="text-muted-soft mb-3 mx-auto" style={{ maxWidth: 420 }}>
          {message}
        </p>
      )}
      {action}
    </div>
  );
}
