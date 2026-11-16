import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;

export function DropdownMenuContent({ className, align = "end", sideOffset = 6, ...props }) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn("z-50 min-w-48 rounded-2xl border border-line bg-white p-1.5 shadow-lift", className)}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuLabel({ className, ...props }) {
  return <DropdownPrimitive.Label className={cn("label-mono px-2.5 py-2 text-muted", className)} {...props} />;
}

export function DropdownMenuCheckboxItem({ className, children, ...props }) {
  return (
    <DropdownPrimitive.CheckboxItem
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-xl py-2 pr-2.5 pl-8 text-sm outline-none select-none data-[highlighted]:bg-lavender",
        className,
      )}
      onSelect={(event) => event.preventDefault()}
      {...props}
    >
      <span className="absolute left-2.5 flex size-4 items-center justify-center">
        <DropdownPrimitive.ItemIndicator>
          <Check className="size-4 text-primary" />
        </DropdownPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownPrimitive.CheckboxItem>
  );
}
