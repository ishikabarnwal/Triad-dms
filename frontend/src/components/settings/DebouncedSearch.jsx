import { MagnifyingGlass } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Input } from "../ui/input";

const SEARCH_DELAY_MS = 300;

/** Search box that reports its value once typing pauses. */
export default function DebouncedSearch({ value, onChange, label, placeholder }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (draft.trim() === value) {
      return undefined;
    }
    const timer = setTimeout(() => onChange(draft.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);
  return (
    <div className="relative w-full sm:w-72">
      <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <Input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 pl-9"
      />
    </div>
  );
}
