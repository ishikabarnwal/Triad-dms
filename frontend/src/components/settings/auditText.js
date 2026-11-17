/**
 * Readable sentences for audit log entries. Each sentence is a list of parts: plain strings,
 * { strong } for names, and { doc, title } for a document that should link to its page.
 */

// Action filter groups and the action prefixes each one covers (the API accepts several, comma separated).
export const ACTION_GROUPS = [
  { value: "signin", label: "Sign in", prefixes: "auth" },
  { value: "uploads", label: "Uploads", prefixes: "document.upload" },
  { value: "downloads", label: "Downloads", prefixes: "document.download,document.preview" },
  { value: "access", label: "Access requests", prefixes: "access" },
  { value: "admin", label: "Admin changes", prefixes: "admin" },
];

// Actions that record something that was refused; they get a red chip.
const FAILURES = {
  "auth.login_failed": "Failed sign in",
  "document.download_denied": "Download denied",
  "document.preview_denied": "Preview denied",
};

export const failureLabel = (action) => FAILURES[action] || null;

/** The document an entry is about, if any: its id and the best title we have. */
function documentOf(entry) {
  const details = entry.details || {};
  const id = entry.target_type === "document" ? entry.target_id : details.document_id;
  if (!id) {
    return null;
  }
  return { doc: id, title: details.title || details.document_title || details.filename || "a document" };
}

const ROLE_WORDS = { admin: "an admin", member: "a member" };

/** "made Asha Verma an admin", "moved Asha Verma to Division B", or both in one sentence. */
function userChange(details) {
  const after = details.after || {};
  const person = { strong: details.name || "a user" };
  const role = ROLE_WORDS[after.role] || after.role;
  if (after.role && after.division) {
    return ["made ", person, ` ${role} and moved them to `, { strong: after.division }];
  }
  if (after.role) {
    return ["made ", person, ` ${role}`];
  }
  if (after.division) {
    return ["moved ", person, " to ", { strong: after.division }];
  }
  return ["updated ", person];
}

/** Everything after the actor's name, by action. */
function predicate(entry) {
  const details = entry.details || {};
  const document = documentOf(entry);
  const requester = details.requester_name ? { strong: details.requester_name } : "someone";

  switch (entry.action) {
    case "auth.login":
      return ["signed in"];
    case "auth.register":
      return ["created an account"];
    case "document.upload":
      return ["uploaded ", document];
    case "document.download":
      return ["downloaded ", document];
    case "document.preview":
      return ["opened ", document];
    case "document.download_denied":
      return ["tried to download ", document, ", without access"];
    case "document.preview_denied":
      return ["tried to open ", document, ", without access"];
    case "access.request":
      return ["asked for access to ", document];
    case "access.approve": {
      const days = details.expires_in_days;
      return ["approved access to ", document, " for ", requester, days ? `, ${days} ${days === 1 ? "day" : "days"}` : ", no expiry"];
    }
    case "access.reject":
      return ["rejected ", requester, "'s request for ", document];
    case "access.revoke":
      return ["revoked ", requester, "'s access to ", document];
    case "admin.field_create":
      return ["added the field ", { strong: details.key }];
    case "admin.field_update":
      if ((details.changes || []).includes("active")) {
        return ["restored the field ", { strong: details.key }];
      }
      return ["changed the field ", { strong: details.key }, details.changes?.length ? ` (${details.changes.join(", ")})` : ""];
    case "admin.field_delete":
      return ["hid the field ", { strong: details.key }];
    case "admin.field_reorder":
      return ["reordered the metadata fields"];
    case "admin.division_create":
      return ["added the division ", { strong: details.name }];
    case "admin.division_update":
      if (details.changes?.name) {
        return ["renamed the division ", { strong: details.name }, " to ", { strong: details.changes.name }];
      }
      return ["updated the division ", { strong: details.name }];
    case "admin.division_delete":
      return ["deleted the division ", { strong: details.name }];
    case "admin.user_update":
      return userChange(details);
    default:
      return [entry.action];
  }
}

/** The whole sentence. Entries without an actor read from the system's side. */
export function auditSentence(entry) {
  const details = entry.details || {};
  if (entry.action === "auth.login_failed") {
    const account = details.login_id ? { strong: details.login_id } : "an unknown account";
    return details.reason === "unknown_user"
      ? ["Someone tried to sign in as ", account, ", which doesn't exist"]
      : ["Wrong password for ", account];
  }
  const parts =
    !entry.actor_name && entry.action === "document.upload"
      ? [documentOf(entry), " was uploaded through the API without signing in"]
      : [{ strong: entry.actor_name || "Someone" }, " ", ...predicate(entry)];
  return parts.filter((part) => part !== null && part !== "");
}

/** "access_status" -> "Access status" */
export function humanKey(key) {
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The details object as flat label/value rows: nested objects become "Before role", lists are
 * joined, and empty values read "None".
 */
export function detailRows(details, prefix = "") {
  return Object.entries(details || {}).flatMap(([key, value]) => {
    const label = prefix ? `${prefix} ${key.replace(/_/g, " ")}` : humanKey(key);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return detailRows(value, label);
    }
    if (Array.isArray(value)) {
      return [{ label, value: value.length ? value.join(", ") : "None" }];
    }
    if (value === null || value === undefined || value === "") {
      return [{ label, value: "None" }];
    }
    // Code words such as "wrong_password" read as "Wrong password"; ids, names and numbers stay as they are.
    const text = String(value);
    return [{ label, value: /^[a-z]+(_[a-z]+)+$/.test(text) ? humanKey(text) : text }];
  });
}
