import { motion } from "framer-motion";
import { Check, Download, Lock, Plus, Search, Send, UploadCloud, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Progress } from "../ui/progress";
import { Switch } from "../ui/switch";
import { useProgress, useSequence } from "./shared";

// Demo data only: these components show how the real UI behaves, with sample names.

/**
 * Two states stacked in one grid cell, cross-fading. Both always take up space and one is always
 * visible, so the demo never shows an empty frame, even in a screenshot taken mid change.
 */
function Swap({ first, second, showSecond, className }) {
  return (
    <div className={cn("grid", className)}>
      {[first, second].map((content, index) => {
        const visible = showSecond === (index === 1);
        return (
          <motion.div
            key={index}
            className="col-start-1 row-start-1"
            animate={{ opacity: visible ? 1 : 0 }}
            transition={{ duration: 0.25 }}
            aria-hidden={!visible}
          >
            {content}
          </motion.div>
        );
      })}
    </div>
  );
}

const ACCESS_STEPS = [2400, 500, 3200];

/** An access request that gets approved, on a loop. */
export function AccessRequestCard({ className, dark = false }) {
  const step = useSequence(ACCESS_STEPS);
  const approved = step === 2;
  return (
    <div className={cn("rounded-xl border p-4", dark ? "border-white/10 bg-white/5" : "border-line bg-white", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className={cn("text-sm font-semibold", dark && "text-white")}>Division B asks for access</p>
        <span className={cn("shrink-0 text-xs", dark ? "text-white/50" : "text-muted")}>2 min ago</span>
      </div>
      <p className={cn("mt-1 text-xs", dark ? "text-white/60" : "text-muted")}>Fleet Maintenance Report, for a joint audit</p>
      <Swap
        className="mt-3"
        showSecond={approved}
        first={
          <div className="flex gap-2">
            <motion.span
              animate={{ scale: step === 1 ? 0.95 : 1 }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white"
            >
              <Check className="size-3.5" aria-hidden="true" /> Approve
            </motion.span>
            <span
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold",
                dark ? "border-white/20 text-white" : "border-line text-ink",
              )}
            >
              <X className="size-3.5" aria-hidden="true" /> Reject
            </span>
          </div>
        }
        second={
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/10 px-3 text-xs font-semibold text-primary">
            <Check className="size-3.5" aria-hidden="true" /> Approved for 7 days
          </span>
        }
      />
    </div>
  );
}

/** The expiry choices an approver picks from, under the request card in the bento. */
export function ExpiryChoices() {
  const options = ["7 days", "30 days", "No end date"];
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className="text-xs text-muted">Access ends after</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {options.map((option, index) => (
          <span
            key={option}
            className={cn(
              "flex h-8 items-center justify-center rounded-lg border text-xs font-semibold",
              index === 0 ? "border-primary bg-primary/10 text-primary" : "border-line text-ink",
            )}
          >
            {option}
          </span>
        ))}
      </div>
    </div>
  );
}

const AUDIT_EVENTS = [
  ["Uploaded a file", "R. Menon", "DIV-A", false],
  ["Requested access", "S. Iyer", "DIV-B", false],
  ["Download refused", "S. Iyer", "DIV-B", true],
  ["Approved a request", "R. Menon", "DIV-A", false],
  ["Downloaded a file", "S. Iyer", "DIV-B", false],
  ["Failed sign in", "Unknown", "DIV-B", true],
  ["Revoked access", "R. Menon", "DIV-A", false],
];
const AUDIT_START_SECONDS = 9 * 3600 + 41 * 60 + 7;

/** "HH:MM:SS" for the nth event, so timestamps always increase down the feed's history. */
function auditTime(sequence) {
  const total = AUDIT_START_SECONDS + sequence * 47;
  return [Math.floor(total / 3600) % 24, Math.floor(total / 60) % 60, total % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

const AUDIT_ROW_PX = 34;

/**
 * Audit rows arriving one after another. The actions mirror the events the backend records.
 * Refusals are marked with a red dot as well as the wording, so colour is never the only signal.
 */
export function AuditTicker({ visible = 4, dark = false, compact = false, intervalMs = 1600, className }) {
  const [count, setCount] = useState(visible + 1);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    const timer = setInterval(() => setCount((current) => current + 1), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  // One extra row sits below the frame, so the oldest row slides out of view instead of vanishing.
  const rows = Array.from({ length: visible + 1 }, (_, index) => {
    const sequence = count - 1 - index;
    return { key: sequence, time: auditTime(sequence), event: AUDIT_EVENTS[sequence % AUDIT_EVENTS.length] };
  });

  return (
    <div className={cn("overflow-hidden text-xs", className)} style={{ height: visible * AUDIT_ROW_PX }}>
      {rows.map(({ key, time, event: [action, who, division, refused] }) => (
        <motion.div
          key={key}
          layout
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={cn("flex h-[34px] items-center gap-3 border-b last:border-b-0", dark ? "border-white/10" : "border-line")}
        >
          <span className={cn("w-14 shrink-0 tabular-nums", dark ? "text-white/45" : "text-muted")}>{time}</span>
          <span className={cn("flex min-w-0 flex-1 items-center gap-2 font-semibold", dark ? "text-white" : refused ? "text-danger" : "text-ink")}>
            {refused && <span className="size-1.5 shrink-0 rounded-full bg-danger" aria-hidden="true" />}
            <span className="truncate">{action}</span>
          </span>
          {!compact && <span className={cn("hidden sm:inline", dark ? "text-white/60" : "text-muted")}>{who}</span>}
          <span className={cn("w-11 text-right", dark ? "text-white/45" : "text-muted")}>{division}</span>
        </motion.div>
      ))}
    </div>
  );
}

const EXTRACTED = ["Fleet report, week 47", "Vehicle 14: brakes done", "Route north cleared 0500"];
const SCAN_STEPS = [2600, 2600];

/** A page with a scan line sweeping it while the extracted text appears beside it. */
export function ScanDocument({ dark = false, className }) {
  const step = useSequence(SCAN_STEPS);
  const lines = step === 0 ? 1 : EXTRACTED.length;
  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div
        className={cn("relative h-36 w-28 shrink-0 overflow-hidden rounded-lg border p-3", dark ? "border-white/15 bg-white/10" : "border-line bg-white")}
        aria-hidden="true"
      >
        {[95, 70, 88, 60, 82, 74, 90, 55].map((width, index) => (
          <span key={index} className={cn("mb-2 block h-1 rounded-full", dark ? "bg-white/25" : "bg-line")} style={{ width: `${width}%` }} />
        ))}
        <span className="absolute inset-x-0 h-0.5 animate-scan bg-primary" />
      </div>
      <div className="min-w-0 flex-1 space-y-2 text-xs">
        <p className={dark ? "text-white/55" : "text-muted"}>Text found on the page</p>
        {EXTRACTED.slice(0, lines).map((line) => (
          <motion.p
            key={line}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn("truncate font-medium", dark ? "text-white" : "text-ink")}
          >
            {line}
          </motion.p>
        ))}
      </div>
    </div>
  );
}

/** A search box with a match count, shown under the scanned page in the OCR card. */
export function SearchRow({ dark = false }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-xs",
        dark ? "border-white/15 bg-white/10 text-white" : "border-line bg-white text-ink",
      )}
    >
      <Search className={cn("size-4", dark ? "text-white/60" : "text-muted")} aria-hidden="true" />
      <span className="flex-1 font-medium">convoy route north</span>
      <span className={dark ? "text-white/60" : "text-muted"}>3 matches</span>
    </div>
  );
}

const FIELDS = [
  ["Report Type", "Select"],
  ["Classification", "Select"],
  ["Document Date", "Date"],
];
const NEW_FIELD = ["Theatre", "Text"];
const FIELD_STEPS = [1800, 2600];

/**
 * Field list where a new field gets added, as an admin would. The new row always takes its space
 * and only fades in, so the list never reflows.
 */
export function MetadataBuilder() {
  const step = useSequence(FIELD_STEPS);
  const added = step === 1;
  return (
    <div className="space-y-2">
      {FIELDS.map(([name, type]) => (
        <div key={name} className="flex h-10 items-center justify-between rounded-lg border border-line bg-white px-3 text-sm">
          <span className="font-medium">{name}</span>
          <span className="text-xs text-muted">{type}</span>
        </div>
      ))}
      <motion.div
        animate={{ opacity: added ? 1 : 0, y: added ? 0 : -6 }}
        transition={{ duration: 0.3 }}
        aria-hidden={!added}
        className="flex h-10 items-center justify-between rounded-lg border border-primary bg-white px-3 text-sm text-primary"
      >
        <span className="font-medium">{NEW_FIELD[0]}</span>
        <span className="text-xs text-muted">{NEW_FIELD[1]}</span>
      </motion.div>
      <div className="flex h-10 items-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 text-xs font-semibold text-primary">
        <Plus className="size-3.5" aria-hidden="true" /> Add field
      </div>
    </div>
  );
}

/** Two division lanes with a lock between them, and a refused request from one to the other. */
export function IsolationLanes() {
  const step = useSequence([1800, 1800]);
  const lane = (name, files) => (
    <div className="min-w-0 flex-1 rounded-lg border border-line bg-white p-3">
      <p className="mb-2 text-xs font-semibold text-muted">{name}</p>
      {files.map((file) => (
        <div key={file} className="mb-1.5 flex items-center gap-2 rounded-md bg-lavender px-2 py-1.5 text-xs last:mb-0">
          <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          <span className="truncate">{file}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div>
      <div className="flex items-center gap-2.5">
        {lane("Division A", ["Fleet", "Routes", "Budget"])}
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-plum text-white">
          <Lock className="size-4" aria-hidden="true" />
        </span>
        {lane("Division B", ["Radar", "Lab tests", "Roster"])}
      </div>
      <motion.div
        animate={{ opacity: step === 1 ? 1 : 0.5 }}
        className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs"
      >
        <span className="text-muted">Division B opens Fleet:</span>
        <span className="font-semibold text-danger">refused</span>
      </motion.div>
    </div>
  );
}

const TOGGLES = ["Required", "Filterable", "Searchable"];

/** A field's settings flipping on and off, using the real switch component. */
export function AdminToggles() {
  const step = useSequence([1500, 1500, 1500]);
  const states = [
    [false, true, true],
    [true, true, true],
    [true, false, true],
  ][step];
  return (
    <div className="space-y-2">
      <div className="flex h-10 items-center justify-between rounded-lg border border-line bg-white px-3 text-sm">
        <span className="font-medium">Classification</span>
        <span className="text-xs text-muted">Select, 4 options</span>
      </div>
      {TOGGLES.map((label, index) => (
        <div key={label} className="flex h-10 items-center justify-between rounded-lg border border-line bg-white px-3 text-sm">
          {label}
          <Switch checked={states[index]} aria-label={label} tabIndex={-1} />
        </div>
      ))}
    </div>
  );
}

/** Step 1: a file dropping into the upload zone and filling its bar. */
export function UploadDemo() {
  const step = useSequence([900, 2200, 1800]);
  const progress = useProgress(step >= 1, 100, 70);
  return (
    <div className="w-full">
      <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-primary/40 bg-white px-6 py-10 text-center">
        <motion.span
          animate={{ y: step === 0 ? -10 : 0, opacity: step === 0 ? 0.4 : 1 }}
          className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          <UploadCloud className="size-5" aria-hidden="true" />
        </motion.span>
        <p className="text-sm font-semibold">Convoy Movement Plan.pdf</p>
        <p className="mt-1 text-xs text-muted">Filed under Division A</p>
      </div>
      <div className="mt-4 rounded-xl border border-line bg-white p-4">
        <div className="mb-2 flex justify-between text-xs text-muted">
          <span>{progress >= 100 ? "Uploaded" : "Uploading"}</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <Progress value={progress} label="Upload progress" />
      </div>
    </div>
  );
}

/** Step 3: a locked document from another division and the request being sent. */
export function RequestDemo() {
  const step = useSequence([2200, 2800]);
  const sent = step === 1;
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-plum text-white">
          <Lock className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Radar Upgrade Specs</p>
          <p className="text-xs text-muted">Division B, Technical, 12 pages</p>
        </div>
      </div>
      <div className="rounded-xl border border-line bg-white p-4">
        <p className="text-xs text-muted">Reason</p>
        <p className="mt-1 text-sm">Needed for the joint radar trial next week.</p>
      </div>
      <Swap
        showSecond={sent}
        first={
          <div className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-white">
            <Send className="size-4" aria-hidden="true" /> Request access
          </div>
        }
        second={
          <div className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary/10 text-sm font-semibold text-primary">
            <Check className="size-4" aria-hidden="true" /> Request sent to Division B
          </div>
        }
      />
    </div>
  );
}

/** Step 4: the approved request and a download button lighting up. */
export function ApproveDownloadDemo() {
  const step = useSequence([1600, 3000]);
  return (
    <div className="w-full space-y-3">
      <AccessRequestCard className="w-full" />
      <motion.div
        animate={{ opacity: step === 1 ? 1 : 0.5 }}
        className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-4"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Fleet Maintenance Report.pdf</p>
          <p className="mt-0.5 text-xs text-muted">Approved for 7 days</p>
        </div>
        <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-white">
          <Download className="size-3.5" aria-hidden="true" /> Download
        </span>
      </motion.div>
    </div>
  );
}
