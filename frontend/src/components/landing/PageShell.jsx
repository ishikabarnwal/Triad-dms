import Footer from "./Footer";
import LandingNav from "./LandingNav";

/** The public page frame: floating nav, the page's content, and the plum footer. */
export default function PageShell({ children }) {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-lavender">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <LandingNav />
      <main id="main" className="flex-1 pt-28 pb-24 sm:pt-32">
        {children}
      </main>
      <Footer />
    </div>
  );
}
