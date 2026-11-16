import Logo from "../components/Logo";

const FEATURES = [
  {
    icon: "bi-shield-lock",
    title: "Division-based access",
    text: "Every file stays inside its division unless access is approved.",
  },
  {
    icon: "bi-search",
    title: "Search inside documents",
    text: "Scanned pages are read with OCR, so their text is searchable.",
  },
  {
    icon: "bi-clipboard-check",
    title: "Fully audited",
    text: "Uploads, downloads and approvals are all logged.",
  },
];

/** Split screen for login and signup: brand panel on the left, the form on the right. */
export default function AuthLayout({ children }) {
  return (
    <div className="auth-shell">
      <section className="auth-brand d-none d-lg-flex">
        <div>
          <Logo large />
        </div>
        <div>
          <h1 className="mb-3">Triad DMS</h1>
          <p className="auth-tagline mb-5">Secure document management for defence divisions.</p>
          {FEATURES.map((feature) => (
            <div className="auth-feature" key={feature.title}>
              <span className="auth-feature-icon">
                <i className={`bi ${feature.icon}`} aria-hidden="true" />
              </span>
              <div>
                <div className="fw-semibold">{feature.title}</div>
                <p>{feature.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="small" style={{ color: "rgba(255,255,255,0.45)" }}>
          Authorised personnel only. All activity is recorded.
        </div>
      </section>

      <section className="auth-form-side flex-column">
        <div className="auth-mobile-brand d-lg-none w-100 mb-4 rounded-4">
          <Logo />
        </div>
        <div className="surface auth-card">{children}</div>
      </section>
    </div>
  );
}
