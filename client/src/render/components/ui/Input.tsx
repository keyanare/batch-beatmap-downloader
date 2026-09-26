import clsx from "clsx";
import { LucideIcon } from "lucide-react";
import React, { useEffect, useState } from "react";

interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  icon?: LucideIcon;
}

export const TextInput = ({ value, onChange, icon: Icon, className, ...props }: TextInputProps) => (
  <div className={clsx("relative", className || "w-full")}>
    {Icon && (
      <Icon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
    )}
    <input
      type="text"
      spellCheck={false}
      className={clsx("field", Icon && "pl-9")}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...props}
    />
  </div>
);

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  /** null means empty */
  value: number | null;
  onChange: (value: number | null) => void;
}

/**
 * A number field that lets the user type freely (including temporarily empty or partial values
 * like "4.") and only reports valid numbers.
 */
export const NumberInput = ({ value, onChange, className, ...props }: NumberInputProps) => {
  const [text, setText] = useState(value === null ? "" : String(value));

  useEffect(() => {
    // Sync external changes, but don't fight the user while they type "4." etc.
    setText((current) => {
      const parsed = current.trim() === "" ? null : Number(current);
      return parsed === value ? current : value === null ? "" : String(value);
    });
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      spellCheck={false}
      className={clsx("field tabular-nums", className)}
      value={text}
      onChange={(event) => {
        const next = event.target.value.replace(",", ".");
        if (!/^-?\d*\.?\d*$/.test(next)) return;
        setText(next);
        if (next.trim() === "" || next === "-") onChange(null);
        else if (!Number.isNaN(Number(next)) && !next.endsWith(".")) onChange(Number(next));
      }}
      {...props}
    />
  );
};
