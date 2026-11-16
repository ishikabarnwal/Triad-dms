import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { errorInfo } from "@/api/client";
import { Button, ButtonArrow } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import AuthLayout from "./AuthLayout";

export function FormAlert({ tone = "danger", children }) {
  const styles = tone === "danger" ? "border-danger/25 bg-danger/5 text-danger" : "border-line bg-lavender text-muted";
  return (
    <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${styles}`} role="alert">
      {children}
    </div>
  );
}

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
      navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
    } catch (err) {
      setError(errorInfo(err).message);
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="label-mono mb-3 text-muted">[ AUTH ] Sign in</div>
      <h2 className="text-3xl font-semibold tracking-[-0.04em]">Welcome back</h2>
      <p className="mt-1.5 mb-7 text-sm text-muted">Sign in to your division&apos;s workspace.</p>

      {expired && !error && <FormAlert tone="info">Your session has ended. Please sign in again.</FormAlert>}
      {error && <FormAlert>{error}</FormAlert>}

      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Email or username" htmlFor="login-identifier">
          <Input
            id="login-identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <Button type="submit" className="mt-2 w-full" disabled={submitting || !identifier || !password}>
          {submitting ? "Signing in…" : "Sign in"}
          {!submitting && <ButtonArrow />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link to="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
