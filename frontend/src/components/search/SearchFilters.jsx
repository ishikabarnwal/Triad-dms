import { X } from "@phosphor-icons/react";
import { useDivisionNames } from "@/hooks/useDivisions";
import { cn } from "@/lib/utils";
import { isDivisionField } from "@/utils/fields";
import { formatDate } from "@/utils/format";
import { FieldFilter } from "../FilterBar";
import { NativeSelect } from "../ui/input";
import { Skeleton } from "../ui/skeleton";

// Built-in filters the search API understands besides the admin-defined fields.
export const DIVISION_KEY = "division";
export const DATE_FROM_KEY = "date_from";
export const DATE_TO_KEY = "date_to";
export const OCR_KEY = "ocr_status";

const OCR_LABELS = { done: "Text ready", failed: "OCR failed", skipped: "OCR off" };

/**
 * Metadata fields shown as search filters: the filterable ones, without the division field,
 * because the built-in division filter covers it.
 */
export const metadataFilterFields = (fields) => fields.filter((field) => field.filterable && !isDivisionField(field));

/** Every filter key the page reads from the URL. */
export function filterKeys(fields) {
  return [DIVISION_KEY, DATE_FROM_KEY, DATE_TO_KEY, OCR_KEY, ...metadataFilterFields(fields).map((field) => field.key)];
}

/** The filters currently set, as { key, label } pairs for the removable chips. */
export function activeFilters(values, fields) {
  const chips = [];
  if (values[DIVISION_KEY]) {
    chips.push({ key: DIVISION_KEY, label: `Division: ${values[DIVISION_KEY]}` });
  }
  metadataFilterFields(fields).forEach((field) => {
    const value = values[field.key];
    if (value) {
      chips.push({ key: field.key, label: `${field.label}: ${field.type === "date" ? formatDate(value) : value}` });
    }
  });
  if (values[DATE_FROM_KEY]) {
    chips.push({ key: DATE_FROM_KEY, label: `Uploaded from ${formatDate(values[DATE_FROM_KEY])}` });
  }
  if (values[DATE_TO_KEY]) {
    chips.push({ key: DATE_TO_KEY, label: `Uploaded until ${formatDate(values[DATE_TO_KEY])}` });
  }
  if (values[OCR_KEY]) {
    chips.push({ key: OCR_KEY, label: `Text: ${OCR_LABELS[values[OCR_KEY]] || values[OCR_KEY]}` });
  }
  return chips;
}

/** A labelled date box, matching the date filters on the dashboard. */
function DateBox({ label, value, onChange }) {
  return (
    <label
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-lg border bg-white pr-2 pl-3 text-sm focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 sm:w-auto",
        value ? "border-primary/50" : "border-line",
      )}
    >
      <span className="shrink-0 text-muted">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-ink outline-none" />
    </label>
  );
}

function SelectFilter({ label, value, onChange, children }) {
  return (
    <NativeSelect
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
      className={cn("h-10 w-full sm:w-auto sm:min-w-40", value && "border-primary/50 text-primary")}
    >
      {children}
    </NativeSelect>
  );
}

/** Division, every filterable metadata field, upload date range and text status. */
export default function SearchFilters({ fields, values, loading, onChange, onClear }) {
  const divisions = useDivisionNames();

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2" aria-hidden="true">
        {[40, 44, 44, 52, 52, 40].map((width, index) => (
          <Skeleton key={index} className="h-10 rounded-lg" style={{ width: `${width * 4}px` }} />
        ))}
      </div>
    );
  }

  const anyActive = filterKeys(fields).some((key) => values[key]);

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
      <SelectFilter label="Division" value={values[DIVISION_KEY] || ""} onChange={(value) => onChange(DIVISION_KEY, value)}>
        <option value="">Any division</option>
        {divisions.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </SelectFilter>
      {metadataFilterFields(fields).map((field) => (
        <FieldFilter key={field.id} field={field} value={values[field.key] || ""} onChange={onChange} />
      ))}
      <DateBox label="Uploaded from" value={values[DATE_FROM_KEY] || ""} onChange={(value) => onChange(DATE_FROM_KEY, value)} />
      <DateBox label="to" value={values[DATE_TO_KEY] || ""} onChange={(value) => onChange(DATE_TO_KEY, value)} />
      <SelectFilter label="Text status" value={values[OCR_KEY] || ""} onChange={(value) => onChange(OCR_KEY, value)}>
        <option value="">Any text status</option>
        {Object.entries(OCR_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectFilter>
      {anyActive && (
        <button type="button" onClick={onClear} className="cursor-pointer px-2 text-sm font-semibold text-primary hover:underline">
          Clear filters
        </button>
      )}
    </div>
  );
}

/** The active filters as chips, each with a button that removes it. */
export function ActiveFilterChips({ chips, onRemove }) {
  if (!chips.length) {
    return null;
  }
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Active filters">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={() => onRemove(chip.key)}
            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 pr-1.5 pl-2.5 text-xs font-semibold text-primary transition-colors hover:border-primary/40"
            aria-label={`Remove filter ${chip.label}`}
          >
            {chip.label}
            <X className="size-3.5" weight="bold" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
