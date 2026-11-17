import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

const SEARCH_DELAY_MS = 300;

/**
 * The large search box. Typing reports the value once it pauses for 300ms; Enter reports it at once.
 * `value` is the committed query (from the URL), so back and forward keep the box in step.
 */
export default function SearchInput({ value, onChange }) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (draft.trim() === value) {
      return undefined;
    }
    const timer = setTimeout(() => onChange(draft.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);

  const clear = () => {
    setDraft("");
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onChange(draft.trim());
      }}
      className="relative"
    >
      <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        // The search page exists to type into, so the box takes focus when it opens.
        autoFocus
        value={draft}
        maxLength={200}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Search by title, details or words inside a file"
        aria-label="Search documents"
        className="h-14 w-full rounded-xl border border-line bg-white pr-14 pl-13 text-base text-ink shadow-soft transition-colors placeholder:text-muted/80 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={clear}
          className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-lavender hover:text-ink"
          aria-label="Clear search"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </form>
  );
}
