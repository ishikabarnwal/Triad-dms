import { MagnifyingGlass } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { inputType } from "@/utils/fields";
import { Input, NativeSelect } from "./ui/input";
import { Skeleton } from "./ui/skeleton";

const SEARCH_DELAY_MS = 300;
// The documents API treats "q" as a title and text search, separate from the metadata filters.
export const SEARCH_KEY = "q";

/** A text box that only reports its value once typing pauses. */
function SearchBox({ value, onChange }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft === value) {
      return undefined;
    }
    const timer = setTimeout(() => onChange(draft.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);

  return (
    <div className="relative w-full sm:w-60">
      <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <Input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Search titles or files"
        aria-label="Search titles and file names"
        className="h-10 pl-9"
      />
    </div>
  );
}

/** Free text and number filters apply on Enter or when the box loses focus, not on every key. */
function TextFilter({ field, value, onChange }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft.trim() !== value && onChange(field.key, draft.trim());
  return (
    <Input
      type={inputType(field)}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => event.key === "Enter" && commit()}
      placeholder={field.label}
      aria-label={field.label}
      className="h-10 w-full sm:w-44"
    />
  );
}

/** One control per filterable field, shaped by its type. */
export function FieldFilter({ field, value, onChange }) {
  const active = Boolean(value);
  if (field.type === "select") {
    return (
      <NativeSelect
        value={value}
        onChange={(event) => onChange(field.key, event.target.value)}
        aria-label={field.label}
        className={cn("h-10 w-full sm:w-auto sm:min-w-40", active && "border-primary/50 text-primary")}
      >
        <option value="">Any {field.label.toLowerCase()}</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </NativeSelect>
    );
  }
  if (field.type === "date") {
    return (
      <label
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg border bg-white pr-2 pl-3 text-sm focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15 sm:w-auto",
          active ? "border-primary/50" : "border-line",
        )}
      >
        <span className="shrink-0 text-muted">{field.label}</span>
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(field.key, event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-ink outline-none"
        />
      </label>
    );
  }
  return <TextFilter field={field} value={value} onChange={onChange} />;
}

/**
 * The filter row, built from the admin-defined metadata fields that are marked filterable.
 * `values` holds the current URL params; `onChange(key, value)` updates one of them.
 */
export default function FilterBar({ fields, values, onChange, onClear, loading }) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[64, 44, 44, 40].map((width, index) => (
          <Skeleton key={index} className="h-10 rounded-lg" style={{ width: `${width * 4}px` }} />
        ))}
      </div>
    );
  }
  const filterable = fields.filter((field) => field.filterable);
  const active = [SEARCH_KEY, ...filterable.map((field) => field.key)].some((key) => values[key]);

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
      <SearchBox value={values[SEARCH_KEY] || ""} onChange={(text) => onChange(SEARCH_KEY, text)} />
      {filterable.map((field) => (
        <FieldFilter key={field.id} field={field} value={values[field.key] || ""} onChange={onChange} />
      ))}
      {active && (
        <button type="button" onClick={onClear} className="cursor-pointer px-2 text-sm font-semibold text-primary hover:underline">
          Clear filters
        </button>
      )}
    </div>
  );
}
