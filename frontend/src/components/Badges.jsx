import { Badge, OverlayTrigger, Tooltip } from "react-bootstrap";

const ACCESS = {
  owner: { label: "Owner", icon: "bi-person-check", className: "badge-soft-primary", tip: "Your division owns this document." },
  admin: { label: "Admin", icon: "bi-shield-check", className: "badge-soft-primary", tip: "Full access as system administrator." },
  approved: { label: "Approved", icon: "bi-unlock", className: "badge-soft-primary", tip: "Your access request was approved." },
  pending: { label: "Pending", icon: "bi-hourglass-split", className: "badge-soft-grey", tip: "Your access request is waiting for approval." },
  rejected: { label: "Locked", icon: "bi-lock", className: "badge-locked", tip: "Your last request was rejected. You can ask again." },
  revoked: { label: "Locked", icon: "bi-lock", className: "badge-locked", tip: "Your access was revoked. You can ask again." },
  expired: { label: "Locked", icon: "bi-lock", className: "badge-locked", tip: "Your access expired. You can ask again." },
  none: { label: "Locked", icon: "bi-lock", className: "badge-locked", tip: "Belongs to another division. Request access to open it." },
};

const OCR = {
  done: { label: "Done", icon: "bi-check2", className: "badge-soft-primary", tip: "Text extracted and searchable." },
  failed: { label: "Failed", icon: "bi-exclamation-triangle", className: "badge-soft-danger", tip: "Text could not be extracted." },
  skipped: { label: "Skipped", icon: "bi-dash", className: "badge-soft-grey", tip: "Text extraction was turned off." },
};

function IconBadge({ icon, label, className }) {
  return (
    <Badge bg="" pill className={`${className} d-inline-flex align-items-center gap-1`}>
      <i className={`bi ${icon}`} aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function AccessBadge({ status }) {
  const config = ACCESS[status] || ACCESS.none;
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{config.tip}</Tooltip>}>
      <span>
        <IconBadge {...config} />
      </span>
    </OverlayTrigger>
  );
}

export function OcrBadge({ status }) {
  const config = OCR[status] || OCR.skipped;
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{config.tip}</Tooltip>}>
      <span>
        <IconBadge {...config} />
      </span>
    </OverlayTrigger>
  );
}

export function DivisionBadge({ name }) {
  return <IconBadge icon="bi-building" label={name} className="badge-division" />;
}

/** Icon tile for a document's file type. */
export function FileIcon({ contentType }) {
  const icon = contentType === "application/pdf" ? "bi-file-earmark-pdf" : "bi-file-earmark-image";
  return (
    <span className="file-icon">
      <i className={`bi ${icon}`} aria-hidden="true" />
    </span>
  );
}
