import { FileText, Search, Settings, ShieldCheck } from "lucide-react";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute, { FullPageSpinner, GuestRoute } from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import PrivacyPage from "./pages/PrivacyPage";
import SignupPage from "./pages/SignupPage";
import TermsPage from "./pages/TermsPage";

// The landing page (smooth scroll, animations) and the dashboard (charts) are the heaviest
// screens, so each is downloaded only when it's first opened.
const LandingPage = lazy(() => import("./pages/LandingPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));

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
            <Route path="/search" element={<PlaceholderPage code="[ SEARCH ]" title="Search" Icon={Search} />} />
            <Route path="/access" element={<PlaceholderPage code="[ ACCESS ]" title="Access requests" Icon={ShieldCheck} />} />
            <Route path="/documents/:id" element={<PlaceholderPage code="[ DOCUMENT ]" title="Document" Icon={FileText} />} />
            <Route element={<ProtectedRoute adminOnly />}>
              <Route path="/settings" element={<PlaceholderPage code="[ ADMIN ]" title="Settings" Icon={Settings} />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
