/** One number on the dashboard. Shows a skeleton while loading. */
export default function StatCard({ icon, label, value, hint, loading }) {
  return (
    <div className="surface stat-card d-flex align-items-center gap-3">
      <span className="stat-icon">
        <i className={`bi ${icon}`} aria-hidden="true" />
      </span>
      <div style={{ minWidth: 0 }}>
        {loading ? (
          <span className="skeleton" style={{ width: "3rem", height: "1.6rem" }} />
        ) : (
          <div className="stat-value">{value}</div>
        )}
        <div className="stat-label">{label}</div>
        {hint && !loading && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}
