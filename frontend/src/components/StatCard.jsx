import { useReducedMotion } from "framer-motion";
import CountUp from "react-countup";
import { LiftCard } from "./motion";

/** One number on the dashboard, counting up from zero. `dark` makes it the plum accent card. */
export default function StatCard({ Icon, label, value, hint, loading, dark = false }) {
  const reduced = useReducedMotion();
  return (
    <LiftCard className={`${dark ? "surface-dark" : "surface"} stat-card d-flex flex-column gap-3`}>
      <span className={`icon-tile ${dark ? "on-dark" : ""}`}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <div>
        {loading ? (
          <span className="skeleton" style={{ width: "3rem", height: "1.8rem" }} />
        ) : (
          <div className="stat-value">
            <CountUp end={value} duration={reduced ? 0 : 1.2} preserveValue />
          </div>
        )}
        <div className="stat-label mt-1">{label}</div>
        {hint && !loading && <div className="stat-hint">{hint}</div>}
      </div>
    </LiftCard>
  );
}
