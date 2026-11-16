import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

// The event types the backend really writes to audit_logs.
const EVENTS = [
  { action: "document.upload", detail: "Fleet Maintenance Report.pdf", who: "R. Menon", division: "Division A" },
  { action: "auth.login_failed", detail: "wrong password", who: "unknown", division: "Division B" },
  { action: "access.request", detail: "Fleet Maintenance Report", who: "S. Iyer", division: "Division B" },
  { action: "document.download_denied", detail: "Fleet Maintenance Report", who: "S. Iyer", division: "Division B" },
  { action: "access.approve", detail: "expires in 7 days", who: "R. Menon", division: "Division A" },
  { action: "document.download", detail: "Fleet Maintenance Report.pdf", who: "S. Iyer", division: "Division B" },
  { action: "access.revoke", detail: "audit finished", who: "R. Menon", division: "Division A" },
];

const VISIBLE = 5;
const INTERVAL_MS = 2200;

function clock(offsetMinutes) {
  const date = new Date(Date.UTC(2026, 10, 16, 9, 30 + offsetMinutes));
  return date.toISOString().slice(11, 16);
}

/** A mock live audit feed: a new event slides in at the top every couple of seconds. */
export default function AuditFeed() {
  const reduced = useReducedMotion();
  const [count, setCount] = useState(VISIBLE);

  useEffect(() => {
    if (reduced) {
      return undefined;
    }
    const timer = setInterval(() => setCount((current) => current + 1), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reduced]);

  const rows = Array.from({ length: VISIBLE }, (_, index) => {
    const sequence = count - 1 - index;
    return { ...EVENTS[sequence % EVENTS.length], key: sequence, time: clock(sequence * 2) };
  });

  return (
    <div className="surface-dark p-4 h-100">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <div className="fw-semibold text-white">Audit log</div>
          <div className="small" style={{ color: "rgba(255,255,255,0.6)" }}>
            Every upload, download and decision
          </div>
        </div>
        <span className="pill pill-on-dark">Live</span>
      </div>
      <div role="log" aria-label="Example audit log" aria-live="off">
        <AnimatePresence initial={false}>
          {rows.map((row) => (
            <motion.div
              key={row.key}
              layout={!reduced}
              className="mini-row"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <span className="small" style={{ color: "rgba(255,255,255,0.5)", width: "3rem" }}>
                {row.time}
              </span>
              <div style={{ minWidth: 0 }}>
                <code>{row.action}</code>
                <div className="small text-truncate" style={{ color: "rgba(255,255,255,0.72)" }}>
                  {row.who} · {row.division} · {row.detail}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
