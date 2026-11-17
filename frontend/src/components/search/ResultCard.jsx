import { EyeSlash, Hourglass, Key } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { columnFields } from "@/utils/fields";
import { formatDate } from "@/utils/format";
import { AccessChip, Chip, DivisionChip, FileIcon } from "../Chips";
import { Button } from "../ui/button";

const MAX_DETAIL_CHIPS = 4;

/** Turn HTML entities back into characters. DOMParser builds an inert document, so nothing in it runs. */
function decodeEntities(text) {
  return new DOMParser().parseFromString(text, "text/html").documentElement.textContent;
}

/**
 * Split the API's snippet into plain text and highlighted parts. The API escapes everything except
 * its own <mark> tags; rendering the parts as React text (never as HTML) means any other markup
 * would show as harmless text even if it slipped through.
 */
export function snippetParts(html) {
  return html
    .split(/(<mark>[\s\S]*?<\/mark>)/g)
    .filter(Boolean)
    .map((part) => {
      const marked = part.startsWith("<mark>") && part.endsWith("</mark>");
      return { marked, text: decodeEntities(marked ? part.slice(6, -7) : part) };
    });
}

function Snippet({ html }) {
  return (
    <p className="mt-3 rounded-xl bg-lavender/70 px-4 py-3 text-sm leading-6 text-pretty break-words text-ink/85">
      {snippetParts(html).map((part, index) =>
        part.marked ? (
          <mark key={index} className="rounded bg-primary/12 px-0.5 font-semibold text-primary">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

/** "Title · Report Type · Text inside the file", from where the API says the words were found. */
function matchedIn(result, labels) {
  const places = [];
  if (result.matched_in.includes("title")) {
    places.push("Title");
  }
  result.matched_keys.forEach((key) => places.push(labels[key] || key));
  if (result.matched_in.includes("content")) {
    places.push("Text inside the file");
  }
  return places;
}

/** Shown instead of a snippet when the viewer can't read the file. */
function HiddenText({ result, onRequest }) {
  let action = null;
  if (result.access_status === "pending") {
    action = (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Hourglass className="size-4 text-primary" aria-hidden="true" />
        Request pending
      </span>
    );
  } else if (result.can_request_access) {
    action = (
      <Button size="sm" variant="outline" onClick={() => onRequest(result)}>
        <Key className="size-4" aria-hidden="true" />
        {result.access_status === "none" ? "Request access" : "Request again"}
      </Button>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
      <p className="flex items-center gap-2 text-sm text-muted">
        <EyeSlash className="size-4 shrink-0" aria-hidden="true" />
        Text inside this file is hidden until access is approved
      </p>
      {action}
    </div>
  );
}

/** A few of the document's own details, by field type, so results can be told apart at a glance. */
function DetailChips({ result, fields }) {
  const chips = columnFields(fields)
    .map((field) => {
      const value = result.metadata?.[field.key];
      if (value === undefined || value === null || value === "") {
        return null;
      }
      return { key: field.key, label: field.label, value: field.type === "date" ? formatDate(value) : String(value) };
    })
    .filter(Boolean)
    .slice(0, MAX_DETAIL_CHIPS);
  if (!chips.length) {
    return null;
  }
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Details">
      {chips.map((chip) => (
        <li key={chip.key}>
          <Chip tone="outline">
            <span className="font-medium text-muted">{chip.label}</span>
            {chip.value}
          </Chip>
        </li>
      ))}
    </ul>
  );
}

/** One search hit: what it is, where it matched, and either the matching text or why it's hidden. */
export default function ResultCard({ result, fields, from, onRequest }) {
  const labels = Object.fromEntries(fields.map((field) => [field.key, field.label]));
  const places = matchedIn(result, labels);

  return (
    <article className="card flex gap-4 p-5" aria-labelledby={`result-${result.id}`}>
      <FileIcon contentType={result.content_type} className="hidden size-11 rounded-xl sm:flex [&>svg]:size-6" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 id={`result-${result.id}`} className="text-[17px] leading-snug font-bold tracking-[-0.02em] break-words">
              <Link to={`/documents/${result.id}`} state={{ from }} className="rounded-sm hover:text-primary">
                {result.title}
              </Link>
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {result.filename} · Uploaded {formatDate(result.created_at)}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <DivisionChip name={result.division} />
            <AccessChip status={result.access_status} />
          </div>
        </div>

        {places.length > 0 && (
          <p className="mt-2.5 text-xs text-muted">
            Matched in <span className="font-semibold text-ink">{places.join(" · ")}</span>
          </p>
        )}

        {result.can_download ? result.snippet && <Snippet html={result.snippet} /> : <HiddenText result={result} onRequest={onRequest} />}

        <DetailChips result={result} fields={fields} />
      </div>
    </article>
  );
}
