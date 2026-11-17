import { GearSix, List, MagnifyingGlass, ShieldCheck, SignOut, SquaresFour } from "@phosphor-icons/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import usePendingCount from "@/hooks/usePendingCount";
import { cn } from "@/lib/utils";
import { initials } from "@/utils/format";
import Logo from "./Logo";
import { PageTransition } from "./motion";
import { SheetContent } from "./ui/dialog";

// Only downloaded the first time someone opens it.
const CommandPalette = lazy(() => import("./CommandPalette"));

const WORKSPACE = [
  { to: "/dashboard", label: "Dashboard", Icon: SquaresFour },
  { to: "/search", label: "Search", Icon: MagnifyingGlass },
  { to: "/access", label: "Access requests", Icon: ShieldCheck, showPending: true },
];
const ADMIN = [{ to: "/settings", label: "Settings", Icon: GearSix }];

// Second key of a "G then X" shortcut -> route.
const SHORTCUTS = { d: "/dashboard", s: "/search", a: "/access", c: "/settings" };
const SHORTCUT_WINDOW_MS = 900;

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function isTyping(target) {
  return target.closest("input, textarea, select, [contenteditable=true], [cmdk-input]");
}

function NavItem({ item, pending, onNavigate }) {
  const { to, label, Icon, showPending } = item;
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
          isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-primary" aria-hidden="true" />}
          <Icon className="size-5 shrink-0" weight={isActive ? "fill" : "regular"} aria-hidden="true" />
          <span className="flex-1">{label}</span>
          {showPending && pending > 0 && (
            <span className="rounded-full bg-primary px-2 text-xs leading-5 font-semibold text-white tabular-nums">
              {pending}
              <span className="sr-only"> pending</span>
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function NavSection({ title, items, pending, onNavigate }) {
  return (
    <div>
      <p className="mb-2 px-3 text-xs font-semibold text-white/45">{title}</p>
      <div className="space-y-1">
        {items.map((item) => (
          <NavItem key={item.to} item={item} pending={pending} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function Sidebar({ onNavigate, onOpenPalette }) {
  const { user, isAdmin, logout } = useAuth();
  const pending = usePendingCount(Boolean(user));

  return (
    <div className="flex h-full flex-col bg-plum px-4 py-5 text-white">
      <Link to="/dashboard" onClick={onNavigate} className="self-start px-2" aria-label="Triad DMS dashboard">
        <Logo size="sm" />
      </Link>

      <button
        type="button"
        onClick={onOpenPalette}
        className="mt-7 flex h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/65 transition-colors hover:border-white/25 hover:text-white"
      >
        <MagnifyingGlass className="size-4" aria-hidden="true" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs text-white/75">{isMac ? "⌘ K" : "Ctrl K"}</kbd>
      </button>

      <nav className="mt-7 flex-1 space-y-6" aria-label="Main">
        <NavSection title="Workspace" items={WORKSPACE} pending={pending} onNavigate={onNavigate} />
        {isAdmin && <NavSection title="Admin" items={ADMIN} pending={pending} onNavigate={onNavigate} />}
      </nav>

      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold" aria-hidden="true">
            {initials(user?.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="truncate text-xs text-white/60">
              {user?.division}
              {isAdmin && " · Admin"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          <SignOut className="size-5" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );
}

/** Plum sidebar on desktop, a top bar with a slide-in panel on smaller screens, and the animated page. */
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
      <a
        href="#workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <aside className="hidden w-64 shrink-0 bg-plum lg:block">
        <div className="sticky top-0 h-dvh">
          <Sidebar onOpenPalette={openPalette} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-plum px-4 lg:hidden">
          <Link to="/dashboard" aria-label="Triad DMS dashboard">
            <Logo size="sm" />
          </Link>
          <div className="flex gap-1 text-white">
            <button type="button" onClick={openPalette} className="cursor-pointer rounded-lg p-2.5 hover:bg-white/10" aria-label="Search">
              <MagnifyingGlass className="size-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setMenuOpen(true)} className="cursor-pointer rounded-lg p-2.5 hover:bg-white/10" aria-label="Open menu">
              <List className="size-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent title="Menu">
            <Sidebar onNavigate={() => setMenuOpen(false)} onOpenPalette={openPalette} />
          </SheetContent>
        </DialogPrimitive.Root>

        <main id="workspace" className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
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
