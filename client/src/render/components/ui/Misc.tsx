import clsx from "clsx";
import { CircleAlert, CircleCheck, Info, LucideIcon, TriangleAlert } from "lucide-react";
import React from "react";

export const Tooltip = ({ content, children, className }: { content: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <span className={clsx("group/tooltip relative inline-flex", className)}>
    {children}
    <span
      role="tooltip"
      className={clsx(
        "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[260px] -translate-x-1/2 rounded-lg",
        "border border-line bg-surface-raised px-2.5 py-1.5 text-xs font-normal leading-5 text-fg-muted shadow-pop",
        "opacity-0 transition-opacity delay-150 group-hover/tooltip:opacity-100",
      )}
    >
      {content}
    </span>
  </span>
);

interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "accent" | "success" | "info" | "warning";
}

const statTones = {
  accent: "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
};

export const Stat = ({ label, value, hint, icon: Icon, tone = "accent" }: StatProps) => (
  <div className="flex animate-fade-in items-center gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-card">
    {Icon && (
      <div className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", statTones[tone])}>
        <Icon size={18} strokeWidth={2.2} />
      </div>
    )}
    <div className="min-w-0">
      <div className="text-xs font-medium text-fg-subtle">{label}</div>
      <div className="truncate text-lg font-semibold tabular-nums tracking-tight text-fg">{value}</div>
      {hint && <div className="truncate text-2xs text-fg-subtle">{hint}</div>}
    </div>
  </div>
);

interface CalloutProps {
  tone?: "info" | "warning" | "danger" | "success";
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const calloutStyles = {
  info: { box: "border-info/25 bg-info/[0.07]", icon: Info, color: "text-info" },
  warning: { box: "border-warning/25 bg-warning/[0.07]", icon: TriangleAlert, color: "text-warning" },
  danger: { box: "border-danger/25 bg-danger/[0.07]", icon: CircleAlert, color: "text-danger" },
  success: { box: "border-success/25 bg-success/[0.07]", icon: CircleCheck, color: "text-success" },
};

export const Callout = ({ tone = "info", title, children, action, className }: CalloutProps) => {
  const style = calloutStyles[tone];
  const Icon = style.icon;
  return (
    <div className={clsx("flex animate-fade-in items-center gap-3 rounded-xl border px-4 py-3", style.box, className)}>
      <Icon size={18} className={clsx("shrink-0", style.color)} />
      <div className="min-w-0 flex-1 text-[13px] leading-5">
        {title && <div className="font-medium text-fg">{title}</div>}
        {children && <div className="text-fg-muted">{children}</div>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
};

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex animate-fade-in flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
      <Icon size={22} />
    </div>
    <h3 className="text-[15px] font-semibold">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-[13px] leading-5 text-fg-subtle">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const Divider = ({ className }: { className?: string }) => <div className={clsx("h-px bg-line", className)} />;
