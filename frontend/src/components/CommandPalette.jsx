import { Command } from "cmdk";
import { ArrowRight, FileText, LayoutDashboard, Search, Settings, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchDocuments } from "@/api/search";
import { useAuth } from "@/context/AuthContext";
import { AccessChip, DivisionChip } from "./Chips";
import { Dialog, DialogContent } from "./ui/dialog";

const PAGES = [
  { label: "Dashboard", to: "/dashboard", Icon: LayoutDashboard, keys: "G D" },
  { label: "Search documents", to: "/search", Icon: Search, keys: "G S" },
  { label: "Access requests", to: "/access", Icon: ShieldCheck, keys: "G A" },
  { label: "Settings", to: "/settings", Icon: Settings, keys: "G C", adminOnly: true },
];

const SEARCH_DELAY_MS = 250;
const MIN_QUERY = 2;

const itemClass =
  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none data-[selected=true]:bg-lavender";

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
            <Search className="size-4 text-muted" aria-hidden="true" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search documents or jump to a page…"
              className="h-14 flex-1 bg-white text-[15px] outline-none placeholder:text-muted"
            />
            <kbd className="rounded border border-line px-1.5 font-mono text-[10px] text-muted">ESC</kbd>
          </div>
          <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
            {loading && <Command.Loading className="label-mono px-3 py-6 text-center text-muted">Searching…</Command.Loading>}
            {!loading && !pages.length && !results.length && (
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted">
                {text.length >= MIN_QUERY ? "No documents or pages match." : "Type to search documents."}
              </Command.Empty>
            )}

            {pages.length > 0 && (
              <Command.Group heading="Pages" className="[&_[cmdk-group-heading]]:label-mono [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-muted">
                {pages.map(({ label, to, Icon, keys }) => (
                  <Command.Item key={to} value={`page-${to}`} onSelect={() => go(to)} className={itemClass}>
                    <Icon className="size-4 text-primary" aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    <span className="font-mono text-[10px] tracking-wider text-muted">{keys}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results.length > 0 && (
              <Command.Group heading="Documents" className="[&_[cmdk-group-heading]]:label-mono [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-muted">
                {results.map((doc) => (
                  <Command.Item key={doc.id} value={`doc-${doc.id}`} onSelect={() => go(`/documents/${doc.id}`)} className={itemClass}>
                    <FileText className="size-4 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                    <span className="hidden sm:inline-flex">
                      <DivisionChip name={doc.division} plain />
                    </span>
                    <AccessChip status={doc.access_status} plain />
                    <ArrowRight className="size-3.5 text-muted" aria-hidden="true" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
