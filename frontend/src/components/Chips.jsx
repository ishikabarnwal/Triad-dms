import { Check, FileImage, FilePdf, Hourglass, Lock, LockOpen, Minus, ShieldCheck, UserCheck, Warning } from "@phosphor-icons/react";
import useDivisionCodes from "@/hooks/useDivisions";
import { cn } from "@/lib/utils";
import { Tooltip } from "./ui/tooltip";

const TONES = {
  primary: "bg-primary/10 text-primary border-primary/15",
  solid: "bg-primary text-white border-primary",
  grey: "bg-lavender text-muted border-line",
  danger: "bg-danger/10 text-danger border-danger/20",
  outline: "bg-white text-ink border-line",
  onDark: "bg-white/10 text-white border-white/15",
};

/** Small label for a status or a value, in normal sentence case text. */
export function Chip({ Icon, children, tone = "grey", className }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs font-semibold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3.5" weight="bold" aria-hidden="true" />}
      {children}
    </span>
  );
}

const ACCESS = {
  owner: { label: "Owner", Icon: UserCheck, tone: "primary", tip: "Your division owns this document." },
  admin: { label: "Admin", Icon: ShieldCheck, tone: "primary", tip: "Full access as system administrator." },
  approved: { label: "Approved", Icon: LockOpen, tone: "primary", tip: "Your access request was approved." },
  pending: { label: "Pending", Icon: Hourglass, tone: "outline", tip: "Your request is waiting for the owning division." },
  rejected: { label: "Locked", Icon: Lock, tone: "grey", tip: "Your last request was rejected. You can ask again." },
  revoked: { label: "Locked", Icon: Lock, tone: "grey", tip: "Your access was revoked. You can ask again." },
  expired: { label: "Locked", Icon: Lock, tone: "grey", tip: "Your access expired. You can ask again." },
  none: { label: "Locked", Icon: Lock, tone: "grey", tip: "Belongs to another division. Request access to open it." },
};

const OCR = {
  done: { label: "Text ready", Icon: Check, tone: "primary", tip: "Text extracted and searchable." },
  failed: { label: "OCR failed", Icon: Warning, tone: "danger", tip: "Text could not be extracted. Title and details are still searchable." },
  skipped: { label: "OCR off", Icon: Minus, tone: "grey", tip: "Text extraction was turned off." },
};

function WithTip({ tip, plain, children }) {
  if (plain) {
    return children;
  }
  return (
    <Tooltip content={tip}>
      <span tabIndex={0} aria-label={tip} className="inline-flex rounded-md">
        {children}
      </span>
    </Tooltip>
  );
}

export function AccessChip({ status, plain = false }) {
  const config = ACCESS[status] || ACCESS.none;
  return (
    <WithTip tip={config.tip} plain={plain}>
      <Chip Icon={config.Icon} tone={config.tone}>
        {config.label}
      </Chip>
    </WithTip>
  );
}

export function OcrChip({ status, plain = false }) {
  const config = OCR[status] || OCR.skipped;
  return (
    <WithTip tip={config.tip} plain={plain}>
      <Chip Icon={config.Icon} tone={config.tone}>
        {config.label}
      </Chip>
    </WithTip>
  );
}

/** Division as its short code ("DIV-A"), with the full name in a tooltip. */
export function DivisionChip({ name, plain = false }) {
  const codes = useDivisionCodes();
  const code = codes[name] || name;
  const chip = <Chip tone="outline">{code}</Chip>;
  return plain || code === name ? chip : <WithTip tip={name}>{chip}</WithTip>;
}

/** Icon tile for a document's file type. */
export function FileIcon({ contentType, className }) {
  const Icon = contentType === "application/pdf" ? FilePdf : FileImage;
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary", className)}>
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}
