import clsx from "clsx";
import React from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export const Toggle = ({ checked, onChange, disabled, label }: ToggleProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={clsx(
      "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
      "disabled:cursor-not-allowed disabled:opacity-50",
      checked ? "bg-accent" : "bg-fg-subtle/30 hover:bg-fg-subtle/40",
    )}
  >
    <span
      className={clsx(
        "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
        checked ? "translate-x-[18px]" : "translate-x-0.5",
      )}
    />
  </button>
);

interface SettingRowProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/** A labelled row with a control on the right, used for settings. */
export const SettingRow = ({ title, description, children, className }: SettingRowProps) => (
  <div className={clsx("flex items-center justify-between gap-6 py-3.5", className)}>
    <div className="min-w-0">
      <div className="text-[13px] font-medium text-fg">{title}</div>
      {description && <div className="mt-0.5 text-xs leading-5 text-fg-subtle">{description}</div>}
    </div>
    {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
  </div>
);
