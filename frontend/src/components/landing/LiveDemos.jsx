import { AnimatePresence, motion } from "framer-motion";
import { Check, Download, FileText, KeyRound, Lock, Plus, UploadCloud, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Chip } from "../Chips";
import { Progress } from "../ui/progress";
import { Switch } from "../ui/switch";
import { useProgress, useSequence } from "./shared";

// Demo data only: these components show how the real UI behaves.

const ACCESS_STEPS = [2400, 500, 3200];

/** Access request that gets approved, on a loop. */
export function AccessRequestCard({ className, dark = false }) {
  const step = useSequence(ACCESS_STEPS);
  const approved = step === 2;
  return (
    <div className={cn(dark ? "card-dark" : "card", "w-80 p-4", className)}>
      <div className="mb-2 flex items-center justify-between">
        <Chip tone={dark ? "onDark" : "outline"} mono Icon={KeyRound}>
          REQ.4471
        </Chip>
        <span className={cn("font-mono text-[10.5px]", dark ? "text-white/45" : "text-muted")}>2 MIN AGO</span>
      </div>
      <p className={cn("text-sm font-medium", dark && "text-white")}>DIV-B requests &lsquo;Fleet Maintenance Report&rsquo;</p>
      <p className={cn("mt-0.5 text-xs", dark ? "text-white/55" : "text-muted")}>Reason: joint maintenance audit, week 47</p>
      <div className="mt-3 h-8">
        <AnimatePresence mode="wait" initial={false}>
          {approved ? (
            <motion.div key="ok" className="flex items-center gap-2" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Chip tone="solid" mono Icon={Check}>
                Approved
              </Chip>
              <span className={cn("font-mono text-[10.5px]", dark ? "text-white/55" : "text-muted")}>EXPIRES IN 7D</span>
            </motion.div>
          ) : (
            <motion.div key="ask" className="flex gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.span
                animate={{ scale: step === 1 ? 0.93 : 1 }}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-medium text-white"
              >
                <Check className="size-3.5" aria-hidden="true" /> Approve
              </motion.span>
              <span
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium",
                  dark ? "border-white/20 text-white" : "border-line",
                )}
              >
                <X className="size-3.5" aria-hidden="true" /> Reject
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const AUDIT_EVENTS = [
  ["document.upload", "R.MENON", "DIV-A"],
  ["access.request", "S.IYER", "DIV-B"],
  ["document.download_denied", "S.IYER", "DIV-B"],
  ["access.approve", "R.MENON", "DIV-A"],
  ["document.download", "S.IYER", "DIV-B"],
  ["auth.login_failed", "UNKNOWN", "DIV-B"],
  ["access.revoke", "R.MENON", "DIV-A"],
];
const AUDIT_START_SECONDS = 9 * 3600 + 41 * 60 + 7;

/** "HH:MM:SS" for the nth event, so timestamps always increase down the feed's history. */
function auditTime(sequence) {
  const total = AUDIT_START_SECONDS + sequence * 47;
  return [Math.floor(total / 3600) % 24, Math.floor(total / 60) % 60, total % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

const AUDIT_ROW_PX = 33;

/** Audit rows ticking in one after another. Real event names from the backend. */
export function AuditTicker({ visible = 4, dark = false, intervalMs = 1600, className }) {
  const [count, setCount] = useState(visible);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    const timer = setInterval(() => setCount((current) => current + 1), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  const rows = Array.from({ length: visible }, (_, index) => {
    const sequence = count - 1 - index;
    return { key: sequence, time: auditTime(sequence), event: AUDIT_EVENTS[sequence % AUDIT_EVENTS.length] };
  });

  return (
    // Fixed height and popLayout: the row leaving at the bottom never overlaps the one arriving.
    <div className={cn("overflow-hidden font-mono text-[11px]", className)} style={{ height: visible * AUDIT_ROW_PX }}>
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map(({ key, time, event: [action, who, division] }) => (
          <motion.div
            key={key}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={cn("flex h-[33px] items-center gap-3 border-b", dark ? "border-white/10" : "border-line")}
          >
            <span className={dark ? "text-white/40" : "text-muted"}>{time}</span>
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                action.includes("denied") || action.includes("failed") ? "text-danger" : dark ? "text-white" : "text-primary",
              )}
            >
              {action}
            </span>
            <span className={cn("hidden sm:inline", dark ? "text-white/55" : "text-muted")}>{who}</span>
            <span className={dark ? "text-white/40" : "text-muted"}>{division}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

const EXTRACTED = ["FLEET MAINTENANCE REPORT — WEEK 47", "Vehicle 14: brake lines replaced.", "Convoy route north cleared 0500."];
const SCAN_STEPS = [2600, 2600];

/** A page with a scan line sweeping it while the extracted text types out beside it. */
export function ScanDocument({ dark = false, className }) {
  const step = useSequence(SCAN_STEPS);
  const lines = step === 0 ? 1 : EXTRACTED.length;
  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div
        className={cn(
          "relative h-36 w-28 shrink-0 overflow-hidden rounded-xl border p-3",
          dark ? "border-white/15 bg-white/5" : "border-line bg-white",
        )}
        aria-hidden="true"
      >
        {[95, 70, 88, 60, 82, 74, 90, 55].map((width, index) => (
          <span key={index} className={cn("mb-2 block h-1 rounded-full", dark ? "bg-white/20" : "bg-line")} style={{ width: `${width}%` }} />
        ))}
        <span className="absolute inset-x-0 h-0.5 animate-scan bg-primary" />
      </div>
      <div className="min-w-0 flex-1 space-y-2 font-mono text-[11px]">
        <div className={cn("label-mono", dark ? "text-white/45" : "text-muted")}>Extracted text</div>
        {EXTRACTED.slice(0, lines).map((line) => (
          <motion.div
            key={line}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn("truncate", dark ? "text-white/85" : "text-ink")}
          >
            {line}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const FIELDS = [
  ["Report Type", "SELECT"],
  ["Classification", "SELECT"],
  ["Document Date", "DATE"],
];
const NEW_FIELD = ["Theatre", "TEXT"];
const FIELD_STEPS = [1800, 2600];

/** Field list where a new field gets added, as an admin would. */
export function MetadataBuilder() {
  const step = useSequence(FIELD_STEPS);
  const rows = step === 1 ? [...FIELDS, NEW_FIELD] : FIELDS;
  return (
    <div className="space-y-1.5">
      <AnimatePresence initial={false}>
        {rows.map(([name, type]) => (
          <motion.div
            key={name}
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={cn(
              "flex items-center justify-between rounded-xl border px-3 py-2 text-sm",
              name === NEW_FIELD[0] ? "border-primary bg-primary/5" : "border-line bg-white",
            )}
          >
            <span>{name}</span>
            <span className="font-mono text-[10px] tracking-wider text-muted">{type}</span>
          </motion.div>
        ))}
      </AnimatePresence>
      <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted">
        <Plus className="size-3.5" aria-hidden="true" /> Add field
      </div>
    </div>
  );
}

/** Two division lanes with a lock between them and a refused cross-division request. */
export function IsolationLanes() {
  const step = useSequence([1800, 1800]);
  const lane = (code, files) => (
    <div className="flex-1 rounded-xl border border-line bg-lavender/60 p-3">
      <div className="label-mono mb-2 text-muted">{code}</div>
      {files.map((file) => (
        <div key={file} className="mb-1.5 flex items-center gap-2 rounded-lg border border-line bg-white px-2 py-1.5 text-xs last:mb-0">
          <FileText className="size-3.5 text-primary" aria-hidden="true" />
          <span className="truncate">{file}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div>
      <div className="flex items-center gap-3">
        {lane("DIV-A", ["Fleet report", "Route plan"])}
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-plum text-white">
          <Lock className="size-4" aria-hidden="true" />
        </span>
        {lane("DIV-B", ["Radar specs", "Lab results"])}
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 font-mono text-[10.5px] tracking-wider">
        <span className="text-muted">DIV-B → DIV-A/fleet_report.pdf</span>
        <motion.span animate={{ opacity: step === 1 ? 1 : 0.35 }} className="text-danger">
          403 DENIED
        </motion.span>
      </div>
    </div>
  );
}

const TOGGLES = ["Required", "Filterable", "Searchable"];

/** Field settings flipping on and off, using the real switch component. */
export function AdminToggles() {
  const step = useSequence([1500, 1500, 1500]);
  const states = [
    [false, true, true],
    [true, true, true],
    [true, false, true],
  ][step];
  return (
    <div className="space-y-2">
      <div className="label-mono mb-1 text-muted">Field · Classification</div>
      {TOGGLES.map((label, index) => (
        <div key={label} className="flex items-center justify-between rounded-xl border border-line bg-white px-3 py-2 text-sm">
          {label}
          <Switch checked={states[index]} aria-label={label} tabIndex={-1} />
        </div>
      ))}
    </div>
  );
}

/** Step 1 visual: a file dropping into the upload zone and filling its bar. */
export function UploadDemo() {
  const step = useSequence([900, 2200, 1800]);
  const progress = useProgress(step >= 1, 100, 70);
  return (
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center rounded-[20px] border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-8 text-center">
        <motion.span
          animate={{ y: step === 0 ? -10 : 0, opacity: step === 0 ? 0.4 : 1 }}
          className="mb-3 flex size-11 items-center justify-center rounded-2xl border border-line bg-white text-primary"
        >
          <UploadCloud className="size-5" aria-hidden="true" />
        </motion.span>
        <div className="text-sm font-medium">Convoy Movement Plan.pdf</div>
        <div className="label-mono mt-1 text-muted">Filed under DIV-A</div>
      </div>
      <div className="mt-4">
        <div className="label-mono mb-1.5 flex justify-between text-muted">
          <span>{progress >= 100 ? "Uploaded" : "Uploading"}</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} label="Upload progress" />
      </div>
    </div>
  );
}

/** Step 4 visual: the approved request and a download button lighting up. */
export function ApproveDownloadDemo() {
  const step = useSequence([1600, 3000]);
  return (
    <div className="w-full max-w-sm space-y-3">
      <AccessRequestCard className="w-full" />
      <motion.div
        animate={{ opacity: step === 1 ? 1 : 0.45 }}
        className="flex items-center justify-between rounded-2xl border border-line bg-white px-4 py-3"
      >
        <div>
          <div className="text-sm font-medium">Fleet Maintenance Report.pdf</div>
          <div className="label-mono mt-0.5 text-muted">ACCESS: APPROVED · 7D</div>
        </div>
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-medium text-white">
          <Download className="size-3.5" aria-hidden="true" /> Download
        </span>
      </motion.div>
    </div>
  );
}
