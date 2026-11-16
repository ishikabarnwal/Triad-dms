import { Spinner } from "react-bootstrap";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function FullPageSpinner() {
  return (
    <div className="full-page-center">
      <Spinner animation="border" variant="primary" role="status">
        <span className="visually-hidden">Loading…</span>
      </Spinner>
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
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

/** Login and signup are only for visitors; logged-in users go straight to the app. */
export function GuestRoute() {
  const { user, ready } = useAuth();
  if (!ready) {
    return <FullPageSpinner />;
  }
  return user ? <Navigate to="/" replace /> : <Outlet />;
}
