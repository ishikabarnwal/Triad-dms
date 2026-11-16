import { useEffect, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { getDivisions } from "../api/auth";
import { errorInfo } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import AuthLayout from "./AuthLayout";

const EMPTY = { name: "", email: "", username: "", password: "", division: "" };

// Conflicts and lookups are about one field, so they're shown on that field rather than in a banner.
const FIELD_FOR_ERROR = {
  email_taken: "email",
  username_taken: "username",
  unknown_division: "division",
};

export default function SignupPage() {
  const { register } = useAuth();
  const toast = useToast();
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
      toast.success(`Welcome, ${user.name}`, `You're signed in to ${user.division}.`);
      navigate("/", { replace: true });
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

  const textField = (key, label, props = {}) => (
    <Form.Group className="mb-3" controlId={`signup-${key}`}>
      <Form.Label>{label}</Form.Label>
      <Form.Control value={form[key]} onChange={update(key)} isInvalid={Boolean(fieldErrors[key])} {...props} />
      <Form.Control.Feedback type="invalid">{fieldErrors[key]}</Form.Control.Feedback>
    </Form.Group>
  );

  return (
    <AuthLayout>
      <h2 className="h4 mb-1">Create your account</h2>
      <p className="text-muted-soft mb-4">You&apos;ll see documents from the division you join.</p>

      {error && <Alert variant="danger">{error}</Alert>}
      {fieldErrors.body && <Alert variant="danger">{fieldErrors.body}</Alert>}

      <Form onSubmit={submit} noValidate>
        {textField("name", "Full name", { autoComplete: "name", autoFocus: true })}
        {textField("email", "Email", { type: "email", autoComplete: "email" })}
        {textField("username", "Username (optional)", { autoComplete: "username" })}
        {textField("password", "Password", { type: "password", autoComplete: "new-password" })}

        <Form.Group className="mb-4" controlId="signup-division">
          <Form.Label>Division</Form.Label>
          <Form.Select
            value={form.division}
            onChange={update("division")}
            isInvalid={Boolean(fieldErrors.division || divisionsError)}
          >
            <option value="">{divisions.length ? "Choose your division" : "Loading divisions…"}</option>
            {divisions.map((division) => (
              <option key={division.id} value={division.name}>
                {division.name}
              </option>
            ))}
          </Form.Select>
          <Form.Control.Feedback type="invalid">{fieldErrors.division || divisionsError}</Form.Control.Feedback>
        </Form.Group>

        <Button type="submit" className="w-100" disabled={submitting}>
          {submitting ? <Spinner size="sm" animation="border" /> : "Create account"}
        </Button>
      </Form>

      <p className="text-center text-muted-soft small mt-4 mb-0">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
