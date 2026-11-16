import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute, { GuestRoute } from "./components/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import SignupPage from "./pages/SignupPage";

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="search" element={<PlaceholderPage title="Search" icon="bi-search" />} />
          <Route path="access" element={<PlaceholderPage title="Access Requests" icon="bi-shield-lock" />} />
          <Route path="documents/:id" element={<PlaceholderPage title="Document" icon="bi-file-earmark-text" />} />
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="settings" element={<PlaceholderPage title="Settings" icon="bi-gear" />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
