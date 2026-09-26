import clsx from "clsx";
import React from "react";

interface ProgressProps {
  /** 0 to 1 */
  value: number;
  active?: boolean;
  tone?: "accent" | "success" | "muted" | "warning";
  className?: string;
}

const tones = {
  accent: "bg-gradient-to-r from-accent to-[#b86bff]",
  success: "bg-success",
  muted: "bg-fg-subtle/60",
  warning: "bg-warning",
};

export const Progress = ({ value, active, tone = "accent", className }: ProgressProps) => {
  const percent = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={clsx("h-2 w-full overflow-hidden rounded-full bg-fg-subtle/15", className)}>
      <div
        className={clsx("relative h-full rounded-full transition-[width] duration-500 ease-out", tones[tone])}
        style={{ width: `${percent}%` }}
      >
        {active && (
          <div
            className="absolute inset-0 animate-stripes opacity-25"
            style={{
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,.7) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.7) 50%, rgba(255,255,255,.7) 75%, transparent 75%, transparent)",
              backgroundSize: "28px 28px",
            }}
          />
        )}
      </div>
    </div>
  );
};

export const Spinner = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg
    className={clsx("animate-spin text-accent", className)}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const Skeleton = ({ className }: { className?: string }) => (
  <div
    className={clsx(
      "animate-shimmer rounded-md bg-[length:200%_100%]",
      "bg-gradient-to-r from-fg-subtle/10 via-fg-subtle/20 to-fg-subtle/10",
      className,
    )}
  />
);
