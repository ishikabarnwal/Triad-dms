import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import Logo from "../Logo";
import { Button, ButtonArrow } from "../ui/button";
import { NAV_SECTIONS } from "./content";

/** Floating navbar that tightens after the page scrolls; a slide-down menu on phones. */
export default function LandingNav() {
  const { user } = useAuth();
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4">
      <nav
        aria-label="Main"
        className={cn(
          "mx-auto flex items-center justify-between gap-4 rounded-2xl border border-line bg-white transition-all duration-300",
          compact ? "max-w-4xl py-1.5 pr-1.5 pl-4 shadow-lift" : "max-w-6xl py-2.5 pr-2.5 pl-5 shadow-soft",
        )}
      >
        <a href="#top" aria-label="Back to top" className="shrink-0">
          <Logo bare size="sm" />
        </a>

        <div className="hidden items-center gap-1 lg:flex">
          {NAV_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-lavender hover:text-ink"
            >
              {section.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {user ? (
            <Button asChild size="sm">
              <Link to="/dashboard">
                Open dashboard <ButtonArrow />
              </Link>
            </Button>
          ) : (
            <>
              <Link to="/login" className="hidden px-3 text-sm font-medium text-ink hover:text-primary sm:inline">
                Sign in
              </Link>
              <Button asChild size="sm">
                <Link to="/signup">
                  Create an account <ButtonArrow />
                </Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="iconSm"
            className="lg:hidden"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls="landing-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="landing-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="card mx-auto mt-2 max-w-6xl p-2 lg:hidden"
          >
            {NAV_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm font-medium hover:bg-lavender"
              >
                {section.label}
              </a>
            ))}
            {!user && (
              <Link to="/login" className="block rounded-xl px-4 py-3 text-sm font-medium hover:bg-lavender">
                Sign in
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
