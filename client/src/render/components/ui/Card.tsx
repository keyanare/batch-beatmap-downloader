import clsx from "clsx";
import { LucideIcon } from "lucide-react";
import React from "react";

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  padding?: boolean;
}

export const Card = ({ title, description, icon: Icon, actions, padding = true, className, children, ...props }: CardProps) => (
  <section
    className={clsx("animate-fade-in rounded-2xl border border-line bg-surface shadow-card", className)}
    {...props}
  >
    {(title || actions) && (
      <header className={clsx("flex items-start gap-3", padding ? "px-5 pt-5" : "px-5 py-4", !children && "pb-5")}>
        {Icon && (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Icon size={16} strokeWidth={2.2} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {title && <h2 className="text-[15px] font-semibold leading-6 text-fg">{title}</h2>}
          {description && <p className="mt-0.5 text-[13px] leading-5 text-fg-subtle">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
    )}
    {children && <div className={clsx(padding && "p-5", padding && (title || actions) && "pt-4")}>{children}</div>}
  </section>
);

export const PageHeader = ({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) => (
  <div className="mb-6 flex items-end justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
      {description && <p className="mt-1 text-[13px] text-fg-subtle">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);
