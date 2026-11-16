import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, FileText, KeyRound, ScanText, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ProgressBar } from "react-bootstrap";
import { AccessBadge, DivisionBadge, FileIcon, OcrBadge } from "../Badges";
import { Float } from "../motion";

/** Repeats a timed sequence of steps; returns the current step index. Holds the last step when motion is reduced. */
function useSequence(durations, reduced) {
  const [step, setStep] = useState(reduced ? durations.length - 1 : 0);
  useEffect(() => {
    if (reduced) {
      setStep(durations.length - 1);
      return undefined;
    }
    const timer = setTimeout(() => setStep((current) => (current + 1) % durations.length), durations[step]);
    return () => clearTimeout(timer);
  }, [step, durations, reduced]);
  return step;
}

const SCAN_STEPS = [600, 2400, 3200];

function ScanCard({ reduced }) {
  const step = useSequence(SCAN_STEPS, reduced);
  const [progress, setProgress] = useState(reduced ? 100 : 0);

  useEffect(() => {
    if (reduced) {
      return undefined;
    }
    if (step === 0) {
      setProgress(0);
      return undefined;
    }
    if (step === 1) {
      const timer = setInterval(() => setProgress((current) => Math.min(100, current + 5)), 110);
      return () => clearInterval(timer);
    }
    setProgress(100);
    return undefined;
  }, [step, reduced]);

  const done = step === 2;
  return (
    <div className="surface float-card">
      <div className="d-flex align-items-center gap-3">
        <FileIcon contentType="application/pdf" />
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="fw-medium text-truncate">Fleet Maintenance Report.pdf</div>
          <div className="small text-muted-soft">Division A · 2.4 MB · 3 pages</div>
        </div>
      </div>
      <div className="mt-3">
        {done ? (
          <div className="d-flex align-items-center justify-content-between">
            <OcrBadge status="done" plain />
            <span className="small text-muted-soft">1,842 words searchable</span>
          </div>
        ) : (
          <>
            <div className="d-flex align-items-center justify-content-between small mb-2">
              <span className="d-inline-flex align-items-center gap-2 fw-medium">
                <ScanText size={15} className="text-primary" aria-hidden="true" />
                Scanning… OCR
              </span>
              <span className="text-muted-soft">{progress}%</span>
            </div>
            <ProgressBar now={progress} style={{ height: 6 }} aria-label="OCR progress" />
          </>
        )}
      </div>
    </div>
  );
}

const ACCESS_STEPS = [2600, 600, 3400];

function AccessCard({ reduced }) {
  const step = useSequence(ACCESS_STEPS, reduced);
  const approved = step === 2;
  return (
    <div className="surface float-card">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span className="pill pill-outline">
          <KeyRound size={13} aria-hidden="true" />
          Access request
        </span>
        <span className="small text-muted-soft">2 min ago</span>
      </div>
      <div className="fw-medium mb-1">
        Division B requests &lsquo;Fleet Maintenance Report&rsquo;
      </div>
      <div className="small text-muted-soft mb-3">Reason: joint maintenance audit, week 47</div>
      <AnimatePresence mode="wait" initial={false}>
        {approved ? (
          <motion.div
            key="approved"
            className="d-flex align-items-center gap-2 flex-wrap"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <AccessBadge status="approved" plain />
            <span className="small text-muted-soft">Expires in 7 days</span>
          </motion.div>
        ) : (
          <motion.div key="actions" className="d-flex gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.span
              className="pill pill-solid px-3 py-2"
              animate={step === 1 ? { scale: 0.94 } : { scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <Check size={14} aria-hidden="true" />
              Approve
            </motion.span>
            <span className="pill pill-outline px-3 py-2">
              <X size={14} aria-hidden="true" />
              Reject
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const QUERY = "convoy route";
const TYPE_MS = 110;

function SearchCard({ reduced }) {
  const [typed, setTyped] = useState(reduced ? QUERY.length : 0);

  useEffect(() => {
    if (reduced) {
      setTyped(QUERY.length);
      return undefined;
    }
    // Type the query, hold the result for a while, then start again.
    const delay = typed < QUERY.length ? TYPE_MS : 4200;
    const timer = setTimeout(() => setTyped((current) => (current < QUERY.length ? current + 1 : 0)), delay);
    return () => clearTimeout(timer);
  }, [typed, reduced]);

  const complete = typed === QUERY.length;
  return (
    <div className="surface float-card">
      <div className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill border mb-3" style={{ background: "#FAF9FF" }}>
        <Search size={16} className="text-muted-soft" aria-hidden="true" />
        <span className="fw-medium">
          {QUERY.slice(0, typed)}
          {!reduced && <span className="typing-caret" aria-hidden="true" />}
        </span>
        <span className="ms-auto small text-muted-soft d-none d-sm-inline">Ctrl K</span>
      </div>
      <motion.div animate={{ opacity: complete ? 1 : 0.35 }} transition={{ duration: 0.25 }}>
        <div className="d-flex align-items-center gap-2 mb-1">
          <FileText size={15} className="text-primary" aria-hidden="true" />
          <span className="fw-medium small">Northern Movement Plan</span>
          <span className="ms-auto">
            <DivisionBadge name="Division A" />
          </span>
        </div>
        <div className="small text-muted-soft">
          … the <mark>convoy route</mark> through the northern pass leaves at 0500 …
        </div>
      </motion.div>
    </div>
  );
}

const AUDIT_ROWS = [
  { action: "document.upload", who: "R. Menon", division: "Division A", time: "09:41" },
  { action: "access.request", who: "S. Iyer", division: "Division B", time: "09:44" },
  { action: "access.approve", who: "R. Menon", division: "Division A", time: "09:46" },
];

function AuditCard({ reduced }) {
  const [shown, setShown] = useState(reduced ? AUDIT_ROWS.length : 0);

  useEffect(() => {
    if (reduced) {
      setShown(AUDIT_ROWS.length);
      return undefined;
    }
    const delay = shown < AUDIT_ROWS.length ? 1100 : 3800;
    const timer = setTimeout(() => setShown((current) => (current < AUDIT_ROWS.length ? current + 1 : 0)), delay);
    return () => clearTimeout(timer);
  }, [shown, reduced]);

  return (
    <div className="surface-dark float-card">
      <div className="d-flex align-items-center justify-content-between mb-1">
        <span className="small fw-semibold text-white">Audit log</span>
        <span className="pill pill-on-dark">Live</span>
      </div>
      <div style={{ minHeight: 132 }}>
        <AnimatePresence initial={false}>
          {AUDIT_ROWS.slice(0, shown).map((row) => (
            <motion.div
              key={row.action}
              className="mini-row"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <code>{row.action}</code>
              <span className="text-truncate" style={{ color: "rgba(255,255,255,0.75)" }}>
                {row.who} · {row.division}
              </span>
              <span className="ms-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
                {row.time}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** The hero composition: four cards built from the app's own components, each playing a short loop. */
export default function HeroVisual() {
  const reduced = useReducedMotion();
  return (
    <div className="hero-visual" aria-hidden="true">
      <Float className="fc-slot fc-scan" duration={7} distance={7}>
        <ScanCard reduced={reduced} />
      </Float>
      <Float className="fc-slot fc-access" duration={8} distance={9} delay={0.6}>
        <AccessCard reduced={reduced} />
      </Float>
      <Float className="fc-slot fc-search" duration={6.5} distance={6} delay={1.2}>
        <SearchCard reduced={reduced} />
      </Float>
      <Float className="fc-slot fc-audit" duration={7.5} distance={8} delay={0.3}>
        <AuditCard reduced={reduced} />
      </Float>
    </div>
  );
}
