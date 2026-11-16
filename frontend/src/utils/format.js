const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "16 Nov 2026" from an ISO date or datetime string. */
export function formatDate(value) {
  if (!value) {
    return "—";
  }
  // Plain YYYY-MM-DD values are calendar dates; parse them as local dates so they don't shift a day.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export function formatDateTime(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

export function formatBytes(bytes) {
  if (bytes == null) {
    return "—";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** Initials for an avatar: "Asha Verma" -> "AV". */
export function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

/** Filename without its extension. */
export function fileStem(filename) {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}
