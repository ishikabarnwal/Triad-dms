import { FileText, GearSix, MagnifyingGlass, ShieldCheck } from "@phosphor-icons/react";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import ProtectedRoute, { FullPageSpinner, GuestRoute } from "./components/ProtectedRoute";

// Every screen is its own download, so a visitor only fetches the pages they actually open.
const LandingPage = lazy(() => import("./pages/LandingPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const AppLayout = lazy(() => import("./components/AppLayout"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const PlaceholderPage = lazy(() => import("./pages/PlaceholderPage"));

export default function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/search" element={<PlaceholderPage title="Search" Icon={MagnifyingGlass} />} />
            <Route path="/access" element={<PlaceholderPage title="Access requests" Icon={ShieldCheck} />} />
            <Route path="/documents/:id" element={<PlaceholderPage title="Document" Icon={FileText} />} />
            <Route element={<ProtectedRoute adminOnly />}>
              <Route path="/settings" element={<PlaceholderPage title="Settings" Icon={GearSix} />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
