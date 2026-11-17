import { lazy, Suspense } from "react";
import Hero from "@/components/landing/Hero";
import LandingNav from "@/components/landing/LandingNav";
import useDocumentTitle from "@/hooks/useDocumentTitle";

// The sections below the hero load as a separate chunk while the first screen is already visible.
const BelowFold = lazy(() => import("@/components/landing/BelowFold"));

export default function LandingPage() {
  useDocumentTitle();
  return (
    <div className="overflow-x-clip bg-lavender">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <LandingNav />
      <main id="main">
        <Hero />
        <Suspense fallback={<div className="h-screen" />}>
          <BelowFold />
        </Suspense>
      </main>
    </div>
  );
}
