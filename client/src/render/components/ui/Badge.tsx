import clsx from "clsx";
import React from "react";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-fg-subtle/10 text-fg-muted ring-fg-subtle/15",
  accent: "bg-accent/10 text-accent ring-accent/20",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-warning ring-warning/20",
  danger: "bg-danger/10 text-danger ring-danger/20",
  info: "bg-info/10 text-info ring-info/20",
};

interface BadgeProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
  title?: string;
}

export const Badge = ({ tone = "neutral", children, className, dot, title }: BadgeProps) => (
  <span
    title={title}
    className={clsx(
      "inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-2xs font-semibold ring-1 ring-inset",
      tones[tone],
      className,
    )}
  >
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
    {children}
  </span>
);
