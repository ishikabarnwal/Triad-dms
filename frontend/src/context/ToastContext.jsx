import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Toast, ToastContainer } from "react-bootstrap";

const ToastContext = createContext(null);

const ICONS = {
  success: "bi-check-circle-fill text-primary",
  info: "bi-info-circle-fill text-primary",
  danger: "bi-exclamation-octagon-fill text-danger",
};

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  /** Show a toast: notify({ variant: "success" | "info" | "danger", title, message }). */
  const notify = useCallback(({ variant = "success", title, message }) => {
    setToasts((current) => [...current, { id: nextId++, variant, title, message }]);
  }, []);

  const value = useMemo(
    () => ({
      notify,
      success: (title, message) => notify({ variant: "success", title, message }),
      error: (title, message) => notify({ variant: "danger", title, message }),
    }),
    [notify],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer position="top-end" className="p-3 position-fixed" style={{ zIndex: 2000 }}>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            onClose={() => dismiss(toast.id)}
            delay={toast.variant === "danger" ? 7000 : 4500}
            autohide
            className={`app-toast ${toast.variant === "danger" ? "app-toast-danger" : ""}`}
          >
            <Toast.Body className="d-flex gap-3 align-items-start py-3">
              <i className={`bi ${ICONS[toast.variant] || ICONS.info} fs-5`} aria-hidden="true" />
              <div className="flex-grow-1">
                <div className="fw-semibold">{toast.title}</div>
                {toast.message && <div className="small text-muted-soft mt-1">{toast.message}</div>}
              </div>
              <button type="button" className="btn-close btn-sm" aria-label="Close" onClick={() => dismiss(toast.id)} />
            </Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
