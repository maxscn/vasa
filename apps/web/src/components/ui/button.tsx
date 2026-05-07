import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "#/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost" | "toolbar" | "inverse";
type ButtonSize = "default" | "sm" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 border border-transparent",
  outline:
    "border border-border bg-transparent text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground",
  ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
  toolbar:
    "text-muted-foreground hover:bg-accent hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-foreground",
  inverse: "border border-transparent bg-white text-black shadow-xs hover:bg-white/95",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-12 px-6 py-2",
  sm: "h-9 px-3",
  icon: "h-8 w-8 p-0",
};

export function Button({
  children,
  className,
  size = "default",
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
