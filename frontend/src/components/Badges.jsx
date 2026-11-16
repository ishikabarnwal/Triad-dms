import { AlertTriangle, Building2, Check, FileImage, FileText, Hourglass, Lock, Minus, ShieldCheck, Unlock, UserCheck } from "lucide-react";
import { OverlayTrigger, Tooltip } from "react-bootstrap";

const ACCESS = {
  owner: { label: "Owner", Icon: UserCheck, tone: "pill-primary", tip: "Your division owns this document." },
  admin: { label: "Admin", Icon: ShieldCheck, tone: "pill-primary", tip: "Full access as system administrator." },
  approved: { label: "Approved", Icon: Unlock, tone: "pill-primary", tip: "Your access request was approved." },
  pending: { label: "Pending", Icon: Hourglass, tone: "pill-grey", tip: "Your access request is waiting for approval." },
  rejected: { label: "Locked", Icon: Lock, tone: "pill-plum", tip: "Your last request was rejected. You can ask again." },
  revoked: { label: "Locked", Icon: Lock, tone: "pill-plum", tip: "Your access was revoked. You can ask again." },
  expired: { label: "Locked", Icon: Lock, tone: "pill-plum", tip: "Your access expired. You can ask again." },
  none: { label: "Locked", Icon: Lock, tone: "pill-plum", tip: "Belongs to another division. Request access to open it." },
};

const OCR = {
  done: { label: "Done", Icon: Check, tone: "pill-primary", tip: "Text extracted and searchable." },
  failed: { label: "Failed", Icon: AlertTriangle, tone: "pill-danger", tip: "Text could not be extracted." },
  skipped: { label: "Skipped", Icon: Minus, tone: "pill-grey", tip: "Text extraction was turned off." },
};

/** A small rounded label with an icon. */
export function Pill({ Icon, label, tone = "pill-grey", className = "" }) {
  return (
    <span className={`pill ${tone} ${className}`}>
      {Icon && <Icon size={13} strokeWidth={2.25} aria-hidden="true" />}
      {label}
    </span>
  );
}

function WithTip({ tip, children }) {
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{tip}</Tooltip>}>
      <span tabIndex={0} aria-label={tip}>
        {children}
      </span>
    </OverlayTrigger>
  );
}

export function AccessBadge({ status, plain = false }) {
  const config = ACCESS[status] || ACCESS.none;
  const pill = <Pill Icon={config.Icon} label={config.label} tone={config.tone} />;
  return plain ? pill : <WithTip tip={config.tip}>{pill}</WithTip>;
}

export function OcrBadge({ status, plain = false }) {
  const config = OCR[status] || OCR.skipped;
  const pill = <Pill Icon={config.Icon} label={config.label} tone={config.tone} />;
  return plain ? pill : <WithTip tip={config.tip}>{pill}</WithTip>;
}

export function DivisionBadge({ name }) {
  return <Pill Icon={Building2} label={name} tone="pill-division" />;
}

/** Icon tile for a document's file type. */
export function FileIcon({ contentType, size = "sm" }) {
  const Icon = contentType === "application/pdf" ? FileText : FileImage;
  return (
    <span className={`icon-tile ${size}`}>
      <Icon size={18} aria-hidden="true" />
    </span>
  );
}
