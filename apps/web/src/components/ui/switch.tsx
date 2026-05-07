import type { ButtonHTMLAttributes } from "react";

import { cn } from "#/lib/utils";

export function Switch({
  checked,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { checked: boolean }) {
  return (
    <button
      aria-checked={checked}
      className={cn(
        "inline-flex h-5 w-9 items-center rounded-full border border-transparent bg-input p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-foreground",
        className,
      )}
      data-state={checked ? "checked" : "unchecked"}
      role="switch"
      type="button"
      {...props}
    >
      <span
        className="block h-4 w-4 rounded-full bg-foreground transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-background"
        data-state={checked ? "checked" : "unchecked"}
      />
    </button>
  );
}
