import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ClassificationStrip from "@/components/dossier/ClassificationStrip";
import Logo from "@/components/Logo";
import { Button, ButtonArrow } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import useActiveSection from "@/hooks/useActiveSection";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { CLASSIFICATION, NAV_SECTIONS } from "./content";

const EASE = [0.22, 1, 0.36, 1];

/** Two bars that fold into a cross. Drawn by hand so the change is a transform, not an icon swap. */
function MenuGlyph({ open }) {
  const bar = "absolute left-0 h-[1.5px] w-5 bg-current transition-transform duration-300 ease-file";
  return (
    <span aria-hidden="true" className="relative block h-3 w-5">
      <span className={cn(bar, "top-0", open && "translate-y-[5.25px] rotate-45")} />
      <span className={cn(bar, "bottom-0", open && "-translate-y-[5.25px] -rotate-45")} />
    </span>
  );
}

/** Account actions: one primary action, with signing in kept visually lighter. */
function AccountActions({ user, compact = false }) {
  if (user) {
    return (
      <Button asChild size={compact ? "sm" : "md"}>
        <Link to="/dashboard">
          Open the hub <ButtonArrow />
        </Link>
      </Button>
    );
  }
  return (
    <>
      <Button asChild variant="ghost" size={compact ? "sm" : "md"} className="hidden px-3 sm:inline-flex">
        <Link to="/login">Sign in</Link>
      </Button>
      <Button asChild size={compact ? "sm" : "md"}>
        <Link to="/signup">
          Create an account <ButtonArrow className="hidden sm:block" />
        </Link>
      </Button>
    </>
  );
}

/** Full-height menu for phones and tablets: solid Paper, links arrive in reading order. */
function MobileMenu({ user, onClose, onEscape }) {
  const firstLink = useRef(null);
  const items = [
    ...NAV_SECTIONS.map((section) => ({ key: section.id, href: `#${section.id}`, label: section.label })),
    ...(user
      ? [{ key: "hub", to: "/dashboard", label: "Open the hub" }]
      : [
          { key: "login", to: "/login", label: "Sign in" },
          { key: "signup", to: "/signup", label: "Create an account" },
        ]),
  ];

  useEffect(() => {
    firstLink.current?.focus();
    const closeOnEscape = (event) => event.key === "Escape" && onEscape();
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onEscape]);

  return (
    <motion.nav
      id="site-menu"
      aria-label="Site"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2, ease: EASE } }}
      transition={{ duration: 0.3, ease: EASE }}
      className="fixed inset-x-0 top-22 bottom-0 z-30 overflow-y-auto border-t border-rule bg-paper md:top-24 lg:hidden"
    >
      <ol className="px-4 py-6 md:px-14">
        {items.map((item, index) => {
          const content = (
            <>
              <span className="label-mono w-8 text-muted">{String(index + 1).padStart(2, "0")}</span>
              <span className="display-s">{item.label}</span>
            </>
          );
          const className = "flex min-h-14 items-center gap-4 border-b border-rule py-3 transition-colors duration-200 hover:text-primary";
          return (
            <motion.li
              key={item.key}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: Math.min(index * 0.06, 0.4) }}
            >
              {item.to ? (
                <Link ref={index === 0 ? firstLink : undefined} to={item.to} onClick={onClose} className={className}>
                  {content}
                </Link>
              ) : (
                <a ref={index === 0 ? firstLink : undefined} href={item.href} onClick={onClose} className={className}>
                  {content}
                </a>
              )}
            </motion.li>
          );
        })}
      </ol>
    </motion.nav>
  );
}

/** Sticky classification strip and navigation bar. Solid Paper, flush to the strip, no blur. */
export default function LandingHeader() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const toggleRef = useRef(null);
  const isDesktop = useMediaQuery("(min-width: 64rem)");

  // Escape hands focus back to the button that opened the menu.
  const escapeMenu = useCallback(() => {
    setMenuOpen(false);
    toggleRef.current?.focus();
  }, []);

  // The menu is hidden on desktop, so widening the window must also release its scroll lock.
  useEffect(() => {
    if (isDesktop) {
      setMenuOpen(false);
    }
  }, [isDesktop]);
  const activeSection = useActiveSection(NAV_SECTIONS.map((section) => section.id));

  return (
    <header className="sticky top-0 z-40">
      <ClassificationStrip marking={CLASSIFICATION.full} short={CLASSIFICATION.short} />
      <div className="border-b border-rule bg-paper md:px-6">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 md:h-16 md:border-x md:border-rule md:px-8 lg:px-12">
          <a href="#top" aria-label="Triad DMS, back to top" className="flex shrink-0 items-center gap-3">
            <Logo size="sm" className="md:h-8" />
            <span aria-hidden="true" className="hidden h-6 w-px bg-rule md:block" />
            <span className="label-mono hidden text-muted md:block">Document management</span>
          </a>

          {NAV_SECTIONS.length > 0 && (
            <nav aria-label="Sections" className="hidden lg:block">
              <ul className="flex items-center gap-6">
                {NAV_SECTIONS.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      aria-current={activeSection === section.id ? "location" : undefined}
                      className={cn(
                        "relative py-2 text-sm font-medium text-muted transition-colors duration-200 hover:text-ink",
                        "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 after:ease-file",
                        activeSection === section.id && "text-ink after:scale-x-100",
                      )}
                    >
                      {section.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div className="flex items-center gap-2">
            <AccountActions user={user} compact />
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="-mr-2 flex size-11 cursor-pointer items-center justify-center text-ink lg:hidden"
            >
              <MenuGlyph open={menuOpen} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>{menuOpen && <MobileMenu user={user} onClose={closeMenu} onEscape={escapeMenu} />}</AnimatePresence>
    </header>
  );
}
