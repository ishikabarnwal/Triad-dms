import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getDivisions } from "@/api/auth";
import { errorInfo } from "@/api/client";
import { Button, ButtonArrow } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import AuthLayout from "./AuthLayout";
import { FormAlert } from "./LoginPage";

const EMPTY = { name: "", email: "", username: "", password: "", division: "" };

// Conflicts and lookups are about one field, so they're shown on that field rather than in a banner.
const FIELD_FOR_ERROR = {
  email_taken: "email",
  username_taken: "username",
  unknown_division: "division",
};

const TEXT_FIELDS = [
  ["name", "Full name", { autoComplete: "name", autoFocus: true }],
  ["email", "Email", { type: "email", autoComplete: "email" }],
  ["username", "Username (optional)", { autoComplete: "username" }],
  ["password", "Password", { type: "password", autoComplete: "new-password" }],
];

export default function SignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [divisions, setDivisions] = useState([]);
  const [divisionsError, setDivisionsError] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getDivisions()
      .then((response) => setDivisions(response.data.divisions))
      .catch((err) => setDivisionsError(errorInfo(err).message));
  }, []);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setFieldErrors({});
    const body = Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim() !== ""));
    try {
      const user = await register(body);
      toast.success(`Welcome, ${user.name}`, { description: `You're signed in to ${user.division}.` });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const info = errorInfo(err);
      const field = FIELD_FOR_ERROR[info.code];
      if (field) {
        setFieldErrors({ [field]: info.message });
      } else if (Object.keys(info.fieldErrors).length) {
        setFieldErrors(info.fieldErrors);
      } else {
        setError(info.message);
      }
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="label-mono mb-3 text-muted">[ AUTH ] New account</div>
      <h2 className="text-3xl font-semibold tracking-[-0.04em]">Create your account</h2>
      <p className="mt-1.5 mb-7 text-sm text-muted">You&apos;ll see documents from the division you join.</p>

      {error && <FormAlert>{error}</FormAlert>}
      {fieldErrors.body && <FormAlert>{fieldErrors.body}</FormAlert>}

      <form onSubmit={submit} noValidate className="space-y-4">
        {TEXT_FIELDS.map(([key, label, props]) => (
          <Field key={key} label={label} htmlFor={`signup-${key}`} error={fieldErrors[key]}>
            <Input
              id={`signup-${key}`}
              value={form[key]}
              onChange={update(key)}
              invalid={Boolean(fieldErrors[key])}
              {...props}
            />
          </Field>
        ))}
        <Field label="Division" htmlFor="signup-division" error={fieldErrors.division || divisionsError}>
          <NativeSelect
            id="signup-division"
            value={form.division}
            onChange={update("division")}
            invalid={Boolean(fieldErrors.division || divisionsError)}
          >
            <option value="">{divisions.length ? "Choose your division" : "Loading divisions…"}</option>
            {divisions.map((division) => (
              <option key={division.id} value={division.name}>
                {division.code ? `${division.code} — ${division.name}` : division.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit" className="mt-2 w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
          {!submitting && <ButtonArrow />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
