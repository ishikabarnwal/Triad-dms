/** Friendly placeholder for lists with nothing to show. */
export default function EmptyState({ icon = "bi-inbox", title, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <i className={`bi ${icon}`} aria-hidden="true" />
      </div>
      <h2 className="h5 mb-2">{title}</h2>
      {message && <p className="text-muted-soft mb-3 mx-auto" style={{ maxWidth: 420 }}>{message}</p>}
      {action}
    </div>
  );
}
