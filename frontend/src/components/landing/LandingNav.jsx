import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Logo from "../Logo";

export const SECTIONS = [
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How it works" },
  { id: "security", label: "Security" },
  { id: "faq", label: "FAQ" },
];

/** Floating pill navbar. Tightens after the page scrolls; a slide-down menu on phones. */
export default function LandingNav({ onNavigate }) {
  const { user } = useAuth();
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id) => {
    setOpen(false);
    onNavigate(id);
  };

  const actions = user ? (
    <Link to="/dashboard" className="btn btn-primary btn-sm">
      Open dashboard
      <ArrowRight size={15} className="btn-arrow" aria-hidden="true" />
    </Link>
  ) : (
    <>
      <Link to="/login" className="fw-medium text-reset px-2 d-none d-sm-inline">
        Sign in
      </Link>
      <Link to="/signup" className="btn btn-primary btn-sm">
        Get started
        <ArrowRight size={15} className="btn-arrow" aria-hidden="true" />
      </Link>
    </>
  );

  return (
    <header className="landing-nav-wrap">
      <nav className={`landing-nav ${compact ? "compact" : ""}`} aria-label="Main">
        <button type="button" className="border-0 bg-transparent p-0" onClick={() => go("top")} aria-label="Back to top">
          <Logo bare />
        </button>

        <div className="landing-links d-none d-lg-flex">
          {SECTIONS.map((section) => (
            <button type="button" key={section.id} onClick={() => go(section.id)}>
              {section.label}
            </button>
          ))}
        </div>

        <div className="d-flex align-items-center gap-2">
          {actions}
          <button
            type="button"
            className="btn btn-light btn-icon d-lg-none"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="landing-mobile-menu"
            className="landing-mobile-menu d-lg-none"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {SECTIONS.map((section) => (
              <button type="button" key={section.id} onClick={() => go(section.id)}>
                {section.label}
              </button>
            ))}
            {!user && <Link to="/login">Sign in</Link>}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
