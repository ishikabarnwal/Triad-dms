import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-lavender" role="status">
      <span className="size-8 animate-spin rounded-full border-2 border-line border-t-primary" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Renders child routes only for logged-in users (and only for admins when adminOnly is set). */
export default function ProtectedRoute({ adminOnly = false }) {
  const { user, ready, isAdmin } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <FullPageSpinner />;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

/** Login and signup are only for visitors; logged-in users go straight to the app. */
export function GuestRoute() {
  const { user, ready } = useAuth();
  if (!ready) {
    return <FullPageSpinner />;
  }
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
