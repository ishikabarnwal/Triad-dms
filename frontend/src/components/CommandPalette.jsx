import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, FileText, LayoutDashboard, Search, Settings, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchDocuments } from "../api/search";
import { useAuth } from "../context/AuthContext";
import { AccessBadge, DivisionBadge } from "./Badges";

const PAGES = [
  { label: "Dashboard", to: "/dashboard", Icon: LayoutDashboard },
  { label: "Search documents", to: "/search", Icon: Search },
  { label: "Access requests", to: "/access", Icon: ShieldCheck },
  { label: "Settings", to: "/settings", Icon: Settings, adminOnly: true },
];

const SEARCH_DELAY_MS = 250;
const MIN_QUERY = 2;

/** Ctrl+K palette: jump to a page, or find a document by title through /api/search. */
export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      // Focus once the dialog has mounted.
      setTimeout(() => inputRef.current?.focus(), 0);
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
    onClose();
    navigate(to);
  };

  const text = query.trim().toLowerCase();
  const pages = PAGES.filter((page) => (!page.adminOnly || isAdmin) && page.label.toLowerCase().includes(text));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="cmdk-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="cmdk-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -8, x: "-50%" }}
            transition={{ duration: 0.18 }}
            onKeyDown={(event) => event.key === "Escape" && onClose()}
          >
            <Command shouldFilter={false} label="Command palette" loop>
              <div className="position-relative">
                <Search size={18} className="cmdk-search-icon" aria-hidden="true" />
                <Command.Input
                  ref={inputRef}
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search documents by title, or jump to a page…"
                />
              </div>
              <Command.List>
                {loading && <Command.Loading>Searching…</Command.Loading>}
                {!loading && !pages.length && !results.length && (
                  <Command.Empty>
                    {text.length >= MIN_QUERY ? "No documents or pages match." : "Type to search documents."}
                  </Command.Empty>
                )}

                {pages.length > 0 && (
                  <Command.Group heading="Pages">
                    {pages.map(({ label, to, Icon }) => (
                      <Command.Item key={to} value={`page-${to}`} onSelect={() => go(to)}>
                        <span className="icon-tile sm">
                          <Icon size={16} aria-hidden="true" />
                        </span>
                        <span className="flex-grow-1">{label}</span>
                        <ArrowRight size={15} className="text-muted-soft" aria-hidden="true" />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {results.length > 0 && (
                  <Command.Group heading="Documents">
                    {results.map((doc) => (
                      <Command.Item key={doc.id} value={`doc-${doc.id}`} onSelect={() => go(`/documents/${doc.id}`)}>
                        <span className="icon-tile sm">
                          <FileText size={16} aria-hidden="true" />
                        </span>
                        <span className="flex-grow-1 text-truncate" style={{ minWidth: 0 }}>
                          {doc.title}
                        </span>
                        <span className="d-none d-sm-inline-flex">
                          <DivisionBadge name={doc.division} />
                        </span>
                        <AccessBadge status={doc.access_status} plain />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
