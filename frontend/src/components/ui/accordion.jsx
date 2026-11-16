import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({ className, ...props }) {
  return <AccordionPrimitive.Item className={cn("border-b border-line last:border-b-0", className)} {...props} />;
}

export function AccordionTrigger({ className, children, ...props }) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "group flex flex-1 cursor-pointer items-center justify-between gap-6 py-5 text-left text-base font-medium transition-colors hover:text-primary sm:text-lg",
          className,
        )}
        {...props}
      >
        {children}
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line transition-transform duration-200 group-data-[state=open]:rotate-45 group-data-[state=open]:border-primary group-data-[state=open]:text-primary">
          <Plus className="size-4" aria-hidden="true" />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({ className, children, ...props }) {
  return (
    <AccordionPrimitive.Content className="overflow-hidden text-muted" {...props}>
      <div className={cn("pr-12 pb-5 leading-relaxed", className)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}
