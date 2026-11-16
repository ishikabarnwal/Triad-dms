import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

function Overlay({ className }) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-plum/45 data-[state=open]:animate-fade-in",
        className,
      )}
    />
  );
}

/**
 * Centered dialog. Radix requires a title for screen readers, so `title` is always rendered;
 * pass `hideTitle` to keep it visually hidden.
 */
export function DialogContent({ title, description, hideTitle = false, className, children, closable = true, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        // Without a description Radix needs an explicit undefined, or it warns in the console.
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 data-[state=open]:animate-dialog-in flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[1.5rem] border border-line bg-white shadow-pop focus:outline-none",
          className,
        )}
        {...props}
      >
        <div className={cn("flex items-start justify-between gap-4 px-6 pt-6", hideTitle && "sr-only")}>
          <div>
            <DialogPrimitive.Title className="text-xl font-semibold tracking-tight">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description>
            ) : null}
          </div>
          {closable && !hideTitle && (
            <DialogPrimitive.Close
              className="-mt-1 -mr-2 rounded-full p-2 text-muted transition-colors hover:bg-lavender hover:text-ink"
              aria-label="Close"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          )}
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Slide-in panel from the left, used for the mobile menu. */
export function SheetContent({ title, className, children }) {
  return (
    <DialogPrimitive.Portal>
      <Overlay />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-pop focus:outline-none data-[state=open]:animate-sheet-in",
          className,
        )}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
