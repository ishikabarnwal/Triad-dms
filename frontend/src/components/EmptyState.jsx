import { Tray } from "@phosphor-icons/react";

/** A composed placeholder for lists with nothing to show. `Icon` is a Phosphor icon component. */
export default function EmptyState({ Icon = Tray, title, message, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-bold tracking-[-0.02em]">{title}</h2>
      {message && <p className="mt-2 max-w-md text-sm leading-6 text-pretty text-muted">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
