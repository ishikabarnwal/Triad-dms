import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence } from "framer-motion";
import { LayoutDashboard, LogOut, Menu, Search, Settings, ShieldCheck } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import client from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import useDivisionCodes from "@/hooks/useDivisions";
import usePendingCount from "@/hooks/usePendingCount";
import { cn } from "@/lib/utils";
import { initials } from "@/utils/format";
import Logo from "./Logo";
import { PageTransition } from "./motion";
import { SheetContent } from "./ui/dialog";

// Only downloaded the first time someone opens it.
const CommandPalette = lazy(() => import("./CommandPalette"));

const WORKSPACE = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, keys: "G D" },
  { to: "/search", label: "Search", Icon: Search, keys: "G S" },
  { to: "/access", label: "Access requests", Icon: ShieldCheck, keys: "G A", showPending: true },
];
const ADMIN = [{ to: "/settings", label: "Settings", Icon: Settings, keys: "G C" }];

// Second key of a "G then X" shortcut -> route.
const SHORTCUTS = { d: "/dashboard", s: "/search", a: "/access", c: "/settings" };
const SHORTCUT_WINDOW_MS = 900;

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function isTyping(target) {
  return target.closest("input, textarea, select, [contenteditable=true], [cmdk-input]");
}

/** Reports whether the API and database answer, from /api/health. */
function useSystemStatus() {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    client
      .get("/health")
      .then(() => setStatus("online"))
      .catch(() => setStatus("degraded"));
  }, []);
  return status;
}

function NavItem({ item, pending, onNavigate }) {
  const { to, label, Icon, keys, showPending } = item;
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
          isActive ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("size-4", isActive ? "text-white" : "text-white/55")} aria-hidden="true" />
          <span className="flex-1">{label}</span>
          {showPending && pending > 0 ? (
            <span className="rounded-full bg-primary px-1.5 font-mono text-[10px] leading-5 text-white" aria-label={`${pending} pending`}>
              {pending}
            </span>
          ) : (
            <span className="font-mono text-[10px] tracking-wider text-white/30 opacity-0 transition-opacity group-hover:opacity-100">
              {keys}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ onNavigate, onOpenPalette }) {
  const { user, isAdmin, logout } = useAuth();
  const pending = usePendingCount(Boolean(user));
  const status = useSystemStatus();
  const codes = useDivisionCodes();

  return (
    <div className="flex h-full flex-col bg-plum px-3 py-4 text-white">
      <div className="px-1.5">
        <Logo size="sm" tone="dark" />
        <div className="label-mono mt-4 flex items-center gap-1.5 text-white/45">
          SYS.STATUS
          <span className={cn("size-1.5 rounded-full", status === "online" ? "bg-primary" : "bg-danger")} />
          <span className={status === "online" ? "text-white/80" : "text-white/60"}>{status.toUpperCase()}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenPalette}
        className="mt-5 flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-2.5 text-sm text-white/55 transition-colors hover:border-white/25 hover:text-white"
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded bg-white/10 px-1.5 font-mono text-[10px] text-white/70">{isMac ? "⌘K" : "Ctrl K"}</kbd>
      </button>

      <nav className="mt-6 flex-1 space-y-6" aria-label="Main">
        <div>
          <div className="label-mono mb-2 px-2.5 text-white/35">Workspace</div>
          <div className="space-y-0.5">
            {WORKSPACE.map((item) => (
              <NavItem key={item.to} item={item} pending={pending} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
        {isAdmin && (
          <div>
            <div className="label-mono mb-2 px-2.5 text-white/35">Admin</div>
            {ADMIN.map((item) => (
              <NavItem key={item.to} item={item} pending={pending} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </nav>

      <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 p-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold" aria-hidden="true">
          {initials(user?.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user?.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="rounded-full border border-white/15 px-1.5 font-mono text-[9.5px] leading-4 tracking-wider text-white/70 uppercase">
              {codes[user?.division] || user?.division}
            </span>
            {isAdmin && <span className="font-mono text-[9.5px] tracking-wider text-white/45 uppercase">Admin</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="cursor-pointer rounded-lg p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Compact plum sidebar on desktop, a slide-in sheet on smaller screens, and the animated page. */
export default function AppLayout() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutlet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteUsed, setPaletteUsed] = useState(false);
  const pendingG = useRef(0);

  const openPalette = () => {
    setMenuOpen(false);
    setPaletteUsed(true);
    setPaletteOpen(true);
  };

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteUsed(true);
        setPaletteOpen((current) => !current);
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "g") {
        pendingG.current = Date.now();
        return;
      }
      const route = SHORTCUTS[key];
      if (route && Date.now() - pendingG.current < SHORTCUT_WINDOW_MS && (route !== "/settings" || isAdmin)) {
        pendingG.current = 0;
        navigate(route);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, isAdmin]);

  return (
    <div className="flex min-h-dvh bg-lavender">
      <aside className="hidden w-60 shrink-0 bg-plum lg:block">
        <div className="sticky top-0 h-dvh">
          <Sidebar onOpenPalette={openPalette} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between bg-plum px-4 py-3 lg:hidden">
          <Logo size="sm" tone="dark" />
          <div className="flex gap-1 text-white">
            <button type="button" onClick={openPalette} className="rounded-lg p-2 hover:bg-white/10" aria-label="Search">
              <Search className="size-5" />
            </button>
            <button type="button" onClick={() => setMenuOpen(true)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Open menu">
              <Menu className="size-5" />
            </button>
          </div>
        </header>

        <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent title="Menu">
            <Sidebar onNavigate={() => setMenuOpen(false)} onOpenPalette={openPalette} />
          </SheetContent>
        </DialogPrimitive.Root>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>{outlet}</PageTransition>
          </AnimatePresence>
        </main>
      </div>

      {paletteUsed && (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </Suspense>
      )}
    </div>
  );
}
