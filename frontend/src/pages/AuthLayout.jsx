import { ArrowLeft, ClipboardCheck, ScanSearch, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import { Reveal } from "../components/motion";

const FEATURES = [
  {
    Icon: ShieldCheck,
    title: "Division-based access",
    text: "Files stay inside their division unless an owner approves a request.",
  },
  {
    Icon: ScanSearch,
    title: "Search inside scans",
    text: "PDFs and images are read with OCR, so their text is searchable.",
  },
  {
    Icon: ClipboardCheck,
    title: "Every action logged",
    text: "Uploads, downloads, approvals and failed logins go to the audit log.",
  },
];

/** Split screen for login and signup: solid plum brand panel on the left, the form on the right. */
export default function AuthLayout({ children }) {
  return (
    <div className="auth-shell">
      <section className="auth-brand d-none d-lg-flex">
        <Link to="/" aria-label="Triad DMS home">
          <Logo large />
        </Link>
        <div>
          <span className="section-label on-dark mb-4">Triad DMS</span>
          <h1 className="display-tight mb-3 mt-3">
            Every document.
            <br />
            Right division.
          </h1>
          <p className="auth-tagline mb-5">Secure document management for defence divisions.</p>
          {FEATURES.map(({ Icon, title, text }) => (
            <div className="auth-feature" key={title}>
              <span className="icon-tile on-dark sm">
                <Icon size={18} aria-hidden="true" />
              </span>
              <div>
                <div className="fw-semibold">{title}</div>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="small" style={{ color: "rgba(255,255,255,0.55)" }}>
          Authorised personnel only. All activity is recorded.
        </div>
      </section>

      <section className="auth-form-side">
        <div className="w-100 d-flex justify-content-between align-items-center mb-4" style={{ maxWidth: 440 }}>
          <Link to="/" className="d-lg-none" aria-label="Triad DMS home">
            <Logo />
          </Link>
          <Link to="/" className="small text-muted-soft d-inline-flex align-items-center gap-1 ms-auto">
            <ArrowLeft size={15} aria-hidden="true" />
            Back to home
          </Link>
        </div>
        <Reveal className="surface auth-card" y={16}>
          {children}
        </Reveal>
      </section>
    </div>
  );
}
