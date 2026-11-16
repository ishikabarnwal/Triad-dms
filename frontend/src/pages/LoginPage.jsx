import { useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { errorInfo } from "../api/client";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "./AuthLayout";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const expired = location.state?.reason === "expired";

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(identifier.trim(), password);
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (err) {
      setError(errorInfo(err).message);
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="h4 mb-1">Welcome back</h2>
      <p className="text-muted-soft mb-4">Sign in to your division&apos;s workspace.</p>

      {expired && !error && <Alert variant="secondary">Your session has ended. Please sign in again.</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <Form onSubmit={submit} noValidate>
        <Form.Group className="mb-3" controlId="login-identifier">
          <Form.Label>Email or username</Form.Label>
          <Form.Control
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </Form.Group>
        <Form.Group className="mb-4" controlId="login-password">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Form.Group>
        <Button type="submit" className="w-100" disabled={submitting || !identifier || !password}>
          {submitting ? <Spinner size="sm" animation="border" /> : "Sign in"}
        </Button>
      </Form>

      <p className="text-center text-muted-soft small mt-4 mb-0">
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
