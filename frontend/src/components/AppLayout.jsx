import { useState } from "react";
import { Badge, Button, Nav, Offcanvas } from "react-bootstrap";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import usePendingCount from "../hooks/usePendingCount";
import { initials } from "../utils/format";
import Logo from "./Logo";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "bi-grid-1x2", end: true },
  { to: "/search", label: "Search", icon: "bi-search" },
  { to: "/access", label: "Access Requests", icon: "bi-shield-lock", showPending: true },
  { to: "/settings", label: "Settings", icon: "bi-gear", adminOnly: true },
];

function SidebarContent({ onNavigate }) {
  const { user, isAdmin, logout } = useAuth();
  const pending = usePendingCount(Boolean(user));

  return (
    <div className="sidebar-inner">
      <div className="mb-4 px-1">
        <Logo />
        <div className="sidebar-product mt-3">Document Management</div>
      </div>

      <Nav as="nav" className="sidebar-nav flex-column flex-grow-1" aria-label="Main">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
          <Nav.Link as={NavLink} key={item.to} to={item.to} end={item.end} onClick={onNavigate}>
            <i className={`bi ${item.icon}`} aria-hidden="true" />
            <span>{item.label}</span>
            {item.showPending && pending > 0 && (
              <Badge pill bg="" className="nav-badge" aria-label={`${pending} pending requests`}>
                {pending}
              </Badge>
            )}
          </Nav.Link>
        ))}
      </Nav>

      <div className="sidebar-user d-flex align-items-center gap-2">
        <span className="avatar" aria-hidden="true">
          {initials(user?.name)}
        </span>
        <div className="flex-grow-1 min-w-0" style={{ minWidth: 0 }}>
          <div className="text-white fw-medium text-truncate">{user?.name}</div>
          <div className="small text-truncate" style={{ color: "rgba(255,255,255,0.6)" }}>
            {user?.division}
            {isAdmin && " · Admin"}
          </div>
        </div>
        <Button variant="link" className="text-white-50 p-1" onClick={logout} title="Log out" aria-label="Log out">
          <i className="bi bi-box-arrow-right fs-5" />
        </Button>
      </div>
    </div>
  );
}

/** Plum sidebar on desktop, an off-canvas menu on smaller screens, and the page on the right. */
export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className="sidebar d-none d-lg-block">
        <SidebarContent />
      </aside>

      <div className="app-main">
        <div className="mobile-topbar d-lg-none">
          <Logo />
          <Button variant="link" className="text-white p-1" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <i className="bi bi-list fs-3" />
          </Button>
        </div>

        <Offcanvas show={menuOpen} onHide={() => setMenuOpen(false)} className="sidebar-offcanvas">
          <Offcanvas.Body>
            <SidebarContent onNavigate={() => setMenuOpen(false)} />
          </Offcanvas.Body>
        </Offcanvas>

        <main className="workspace">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
