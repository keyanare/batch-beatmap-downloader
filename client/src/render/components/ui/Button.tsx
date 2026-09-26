import clsx from "clsx";
import { LoaderCircle, LucideIcon } from "lucide-react";
import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg hover:bg-accent-strong shadow-sm shadow-accent/20 disabled:hover:bg-accent",
  secondary: "bg-surface-raised text-fg border border-line hover:bg-surface-sunken hover:border-fg-subtle/40",
  outline: "border border-line text-fg hover:bg-surface-sunken",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface-sunken",
  danger: "bg-danger/10 text-danger hover:bg-danger/20",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl",
};

const iconSizes: Record<Size, number> = { sm: 14, md: 16, lg: 18 };

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", icon: Icon, loading, className, children, disabled, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-all",
        "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        variants[variant],
        sizes[size],
        !children && (size === "sm" ? "w-7 px-0" : size === "md" ? "w-9 px-0" : "w-11 px-0"),
        className,
      )}
      {...props}
    >
      {loading ? (
        <LoaderCircle size={iconSizes[size]} className="animate-spin" />
      ) : (
        Icon && <Icon size={iconSizes[size]} strokeWidth={2.2} />
      )}
      {children}
    </button>
  ),
);

Button.displayName = "Button";
