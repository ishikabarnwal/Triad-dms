import { Link } from "react-router-dom";
import Logo from "../Logo";
import { container } from "./shared";
import { NAV_SECTIONS } from "./content";

// Section links point at the landing page, so they also work from the legal and 404 pages.
const COLUMNS = [
  { title: "Product", links: NAV_SECTIONS.map((section) => ({ label: section.label, href: `/#${section.id}` })) },
  {
    title: "Account",
    links: [
      { label: "Sign in", to: "/login" },
      { label: "Create an account", to: "/signup" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
    ],
  },
];

const linkClass = "text-white/70 transition-colors hover:text-white";

/** Deep plum footer with the white logo, the company address and links. */
export default function Footer() {
  return (
    <footer className="bg-plum text-white">
      <div className={`${container} py-16`}>
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Link to="/" aria-label="Triad DMS home" className="inline-block">
              <Logo size="md" />
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-6 text-white/70">
              Secure document management for defence divisions. A prototype by Triad AI.
            </p>
            <address className="mt-6 text-sm leading-6 text-white/70 not-italic">
              Plot No. 76, Survey No. 252, Malkapoor Village,
              <br />
              Chevella Mandal, Telangana 501503
            </address>
            <a href="https://triad-ai.com" target="_blank" rel="noreferrer" className={`mt-2 inline-block text-sm font-semibold ${linkClass}`}>
              triad-ai.com
            </a>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title} className="lg:col-span-2">
              <h2 className="text-sm font-semibold text-white">{column.title}</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link to={link.to} className={linkClass}>
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className={linkClass}>
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-14 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-6 text-sm text-white/55">
          <span>© 2026 Triad AI Pvt. Ltd.</span>
          <span>Every upload, download and decision is recorded.</span>
        </div>
      </div>
    </footer>
  );
}
