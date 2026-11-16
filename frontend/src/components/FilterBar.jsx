import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils/format";
import { inputType } from "@/utils/fields";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Skeleton } from "./ui/skeleton";

/** Options list for select fields: one click picks a value and closes the popover. */
function SelectOptions({ field, value, onApply }) {
  return (
    <div className="max-h-64 space-y-0.5 overflow-y-auto">
      {field.options.map((option) => (
        <PopoverClose asChild key={option}>
          <button
            type="button"
            onClick={() => onApply(option === value ? "" : option)}
            className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-lavender"
          >
            {option}
            {option === value && <Check className="size-4 text-primary" aria-hidden="true" />}
          </button>
        </PopoverClose>
      ))}
    </div>
  );
}

/** Text, number and date fields: type a value, then apply it. */
function ValueInput({ field, value, onApply }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft.trim());
      }}
      className="space-y-2"
    >
      <Input
        type={inputType(field)}
        value={draft}
        autoFocus
        aria-label={field.label}
        placeholder={field.type === "date" ? undefined : `Exact ${field.label.toLowerCase()}`}
        onChange={(event) => setDraft(event.target.value)}
      />
      <PopoverClose asChild>
        <Button type="submit" size="sm" className="w-full">
          Apply
        </Button>
      </PopoverClose>
    </form>
  );
}

function displayValue(field, value) {
  return field.type === "date" ? formatDate(value) : value;
}

/** One filter as a pill: shows "Field" when empty, "Field: value" with a clear button when set. */
function FilterChip({ field, value, onChange }) {
  const active = Boolean(value);
  return (
    <div
      className={cn(
        "inline-flex h-9 items-center rounded-full border text-sm transition-colors",
        active ? "border-primary/40 bg-primary/8 text-primary" : "border-dashed border-line bg-white text-muted hover:border-primary hover:text-ink",
      )}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="flex h-full cursor-pointer items-center gap-1.5 pr-2 pl-3.5">
            <span className={cn(active && "text-muted")}>{field.label}</span>
            {active && <span className="max-w-40 truncate font-medium text-primary">{displayValue(field, value)}</span>}
            {!active && <ChevronDown className="size-3.5" aria-hidden="true" />}
          </button>
        </PopoverTrigger>
        <PopoverContent>
          <div className="label-mono mb-2 px-1 text-muted">Filter · {field.label}</div>
          {field.type === "select" ? (
            <SelectOptions field={field} value={value} onApply={(next) => onChange(field.key, next)} />
          ) : (
            <ValueInput field={field} value={value || ""} onApply={(next) => onChange(field.key, next)} />
          )}
        </PopoverContent>
      </Popover>
      {active && (
        <button
          type="button"
          onClick={() => onChange(field.key, "")}
          className="mr-1 flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-primary/10"
          aria-label={`Clear ${field.label} filter`}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Filters built from the admin-defined metadata fields (only those marked filterable).
 * `values` maps field key -> current value; `onChange(key, value)` updates one filter.
 */
export default function FilterBar({ fields, values, onChange, onClear, loading }) {
  if (loading) {
    return (
      <div className="flex gap-2">
        {[0, 1, 2].map((n) => (
          <Skeleton key={n} className="h-9 w-28 rounded-full" />
        ))}
      </div>
    );
  }
  const filterable = fields.filter((field) => field.filterable);
  const activeCount = filterable.filter((field) => values[field.key]).length;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
      {filterable.map((field) => (
        <FilterChip key={field.id} field={field} value={values[field.key] || ""} onChange={onChange} />
      ))}
      {activeCount > 0 && (
        <button type="button" onClick={onClear} className="label-mono cursor-pointer px-2 text-muted hover:text-primary">
          Clear all
        </button>
      )}
    </div>
  );
}
