import { AnimatePresence } from "framer-motion";
import { LayoutDashboard, LogOut, Menu, Search, Settings, ShieldCheck } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Button, Nav, Offcanvas } from "react-bootstrap";
import { NavLink, useLocation, useOutlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import usePendingCount from "../hooks/usePendingCount";
import { initials } from "../utils/format";
import Logo from "./Logo";
import { PageTransition } from "./motion";

// Only downloaded the first time someone opens it.
const CommandPalette = lazy(() => import("./CommandPalette"));

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/search", label: "Search", Icon: Search },
  { to: "/access", label: "Access Requests", Icon: ShieldCheck, showPending: true },
  { to: "/settings", label: "Settings", Icon: Settings, adminOnly: true },
];

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function SidebarContent({ onNavigate, onOpenPalette }) {
  const { user, isAdmin, logout } = useAuth();
  const pending = usePendingCount(Boolean(user));

  return (
    <div className="sidebar-inner">
      <div className="mb-4 px-1">
        <Logo />
        <div className="sidebar-caption mt-3">Document Management</div>
      </div>

      <button type="button" className="sidebar-search mb-4" onClick={onOpenPalette}>
        <Search size={16} aria-hidden="true" />
        <span>Quick search</span>
        <kbd>{isMac ? "⌘K" : "Ctrl K"}</kbd>
      </button>

      <Nav as="nav" className="sidebar-nav flex-column flex-grow-1" aria-label="Main">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map(({ to, label, Icon, showPending }) => (
          <Nav.Link as={NavLink} key={to} to={to} onClick={onNavigate}>
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
            {showPending && pending > 0 && (
              <span className="nav-count" aria-label={`${pending} pending requests`}>
                {pending}
              </span>
            )}
          </Nav.Link>
        ))}
      </Nav>

      <div className="sidebar-user d-flex align-items-center gap-2">
        <span className="avatar" aria-hidden="true">
          {initials(user?.name)}
        </span>
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="text-white fw-medium text-truncate">{user?.name}</div>
          <div className="small text-truncate" style={{ color: "rgba(255,255,255,0.65)" }}>
            {user?.division}
            {isAdmin && " · Admin"}
          </div>
        </div>
        <Button variant="link" className="text-white p-1 opacity-75" onClick={logout} title="Log out" aria-label="Log out">
          <LogOut size={18} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/** Plum sidebar on desktop, an off-canvas menu on smaller screens, and the animated page on the right. */
export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteUsed, setPaletteUsed] = useState(false);
  const location = useLocation();
  // useOutlet keeps the old page mounted while it animates out.
  const outlet = useOutlet();

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteUsed(true);
        setPaletteOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPalette = () => {
    setMenuOpen(false);
    setPaletteUsed(true);
    setPaletteOpen(true);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar d-none d-lg-block">
        <SidebarContent onOpenPalette={openPalette} />
      </aside>

      <div className="app-main">
        <div className="mobile-topbar d-lg-none">
          <Logo />
          <div className="d-flex gap-1">
            <Button variant="link" className="text-white p-2" onClick={openPalette} aria-label="Search">
              <Search size={20} aria-hidden="true" />
            </Button>
            <Button variant="link" className="text-white p-2" onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <Menu size={22} aria-hidden="true" />
            </Button>
          </div>
        </div>

        <Offcanvas show={menuOpen} onHide={() => setMenuOpen(false)} className="sidebar-offcanvas" aria-label="Menu">
          <Offcanvas.Body>
            <SidebarContent onNavigate={() => setMenuOpen(false)} onOpenPalette={openPalette} />
          </Offcanvas.Body>
        </Offcanvas>

        <main className="workspace">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>{outlet}</PageTransition>
          </AnimatePresence>
        </main>
      </div>

      {paletteUsed && (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
