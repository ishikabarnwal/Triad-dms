import { ArrowRight, FileText, GearSix, MagnifyingGlass, ShieldCheck, SquaresFour } from "@phosphor-icons/react";
import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchDocuments } from "@/api/search";
import { useAuth } from "@/context/AuthContext";
import { AccessChip, DivisionChip } from "./Chips";
import { Dialog, DialogContent } from "./ui/dialog";

const PAGES = [
  { label: "Dashboard", to: "/dashboard", Icon: SquaresFour, keys: "G D" },
  { label: "Search documents", to: "/search", Icon: MagnifyingGlass, keys: "G S" },
  { label: "Access requests", to: "/access", Icon: ShieldCheck, keys: "G A" },
  { label: "Settings", to: "/settings", Icon: GearSix, keys: "G C", adminOnly: true },
];

const SEARCH_DELAY_MS = 250;
const MIN_QUERY = 2;

const itemClass = "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-[selected=true]:bg-lavender";
const groupClass = "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted";

/** Ctrl+K palette: jump to a page, or find a document through /api/search. */
export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN_QUERY) {
      setResults([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    let active = true;
    const timer = setTimeout(() => {
      searchDocuments({ q: text, limit: 8 })
        .then((response) => active && setResults(response.data.results))
        .catch(() => active && setResults([]))
        .finally(() => active && setLoading(false));
    }, SEARCH_DELAY_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const go = (to) => {
    onOpenChange(false);
    navigate(to);
  };

  const text = query.trim().toLowerCase();
  const pages = PAGES.filter((page) => (!page.adminOnly || isAdmin) && page.label.toLowerCase().includes(text));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Command palette" hideTitle className="top-[14vh] max-w-xl translate-y-0">
        <Command shouldFilter={false} label="Command palette" loop>
          <div className="flex items-center gap-3 border-b border-line px-5">
            <MagnifyingGlass className="size-5 text-muted" aria-hidden="true" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search documents or jump to a page"
              className="h-14 flex-1 bg-white text-[15px] outline-none placeholder:text-muted"
            />
            <kbd className="rounded-md border border-line px-1.5 py-0.5 text-xs text-muted">Esc</kbd>
          </div>
          <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
            {loading && <Command.Loading className="px-3 py-6 text-center text-sm text-muted">Searching</Command.Loading>}
            {!loading && !pages.length && !results.length && (
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted">
                {text.length >= MIN_QUERY ? "No documents or pages match." : "Type to search documents."}
              </Command.Empty>
            )}

            {pages.length > 0 && (
              <Command.Group heading="Pages" className={groupClass}>
                {pages.map(({ label, to, Icon, keys }) => (
                  <Command.Item key={to} value={`page-${to}`} onSelect={() => go(to)} className={itemClass}>
                    <Icon className="size-[18px] text-primary" aria-hidden="true" />
                    <span className="flex-1 font-medium">{label}</span>
                    <span className="text-xs text-muted">{keys}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results.length > 0 && (
              <Command.Group heading="Documents" className={groupClass}>
                {results.map((doc) => (
                  <Command.Item key={doc.id} value={`doc-${doc.id}`} onSelect={() => go(`/documents/${doc.id}`)} className={itemClass}>
                    <FileText className="size-[18px] text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-medium">{doc.title}</span>
                    <span className="hidden sm:inline-flex">
                      <DivisionChip name={doc.division} plain />
                    </span>
                    <AccessChip status={doc.access_status} plain />
                    <ArrowRight className="size-4 text-muted" aria-hidden="true" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {!loading && text.length >= MIN_QUERY && (
              <Command.Group heading="More" className={groupClass}>
                <Command.Item value="see-all" onSelect={() => go(`/search?q=${encodeURIComponent(query.trim())}`)} className={itemClass}>
                  <MagnifyingGlass className="size-[18px] text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium">See all results for “{query.trim()}”</span>
                  <ArrowRight className="size-4 text-muted" aria-hidden="true" />
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
