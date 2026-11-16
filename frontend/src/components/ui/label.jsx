import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }) {
  return <LabelPrimitive.Root className={cn("mb-1.5 block text-sm font-medium text-ink", className)} {...props} />;
}

/** Field wrapper: label, control, and an error or hint line underneath. */
export function Field({ label, htmlFor, required, error, hint, children, className }) {
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}
