import ClassificationStrip from "@/components/dossier/ClassificationStrip";
import { CLASSIFICATION } from "@/components/landing/content";
import Hero from "@/components/landing/Hero";
import LandingHeader from "@/components/landing/LandingHeader";

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-paper">
      <a
        href="#main"
        className="label-mono sr-only bg-primary px-4 py-3 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <LandingHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
      </main>
      <ClassificationStrip as="footer" marking={CLASSIFICATION.full} short={CLASSIFICATION.short} />
    </div>
  );
}
