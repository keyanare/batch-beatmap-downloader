import clsx from "clsx";
import { LucideIcon } from "lucide-react";
import React from "react";

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  size?: "sm" | "md";
}

export const Segmented = <T extends string>({ value, options, onChange, size = "md" }: SegmentedProps<T>) => (
  <div className="inline-flex rounded-lg border border-line bg-surface-sunken p-0.5">
    {options.map(({ value: option, label, icon: Icon }) => (
      <button
        key={option}
        type="button"
        onClick={() => onChange(option)}
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-md font-medium transition-all",
          size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3.5 text-[13px]",
          option === value
            ? "bg-surface-raised text-fg shadow-sm ring-1 ring-line"
            : "text-fg-subtle hover:text-fg",
        )}
      >
        {Icon && <Icon size={14} strokeWidth={2.2} />}
        {label}
      </button>
    ))}
  </div>
);
