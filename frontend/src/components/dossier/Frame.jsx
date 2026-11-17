import { cn } from "@/lib/utils";

/** A small "+" printed where two rules cross, like the crop marks on a printed sheet. */
function RegistrationMark({ className }) {
  return (
    <svg
      viewBox="0 0 11 11"
      aria-hidden="true"
      className={cn("pointer-events-none absolute z-10 hidden size-[11px] text-ink md:block", className)}
    >
      <path d="M5.5 0v11M0 5.5h11" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/**
 * A full-bleed band with the page's binder rules: 1px vertical rules at the content edges
 * (from the md breakpoint) and a horizontal rule closing the band, marked at both crossings.
 */
export default function Frame({ as: Tag = "section", className, innerClassName, marks = true, children, ...props }) {
  return (
    <Tag className={cn("border-b border-rule md:px-6", className)} {...props}>
      <div className={cn("relative mx-auto max-w-7xl md:border-x md:border-rule", innerClassName)}>
        {marks && (
          <>
            <RegistrationMark className="-bottom-[6px] -left-[6px]" />
            <RegistrationMark className="-right-[6px] -bottom-[6px]" />
          </>
        )}
        <div className="px-4 md:px-8 lg:px-12">{children}</div>
      </div>
    </Tag>
  );
}
