import clsx from "clsx";
import React from "react";
import ReactSelect, { Props as ReactSelectProps } from "react-select";

export interface Option {
  value: string;
  label: string;
}

interface SelectProps<T extends Option> extends Omit<ReactSelectProps<T, false>, "onChange" | "value" | "options"> {
  value: T | null | undefined;
  options: readonly T[];
  onChange: (option: T) => void;
  className?: string;
}

/** react-select, styled to match the rest of the app. */
export const Select = <T extends Option>({ value, options, onChange, className, ...props }: SelectProps<T>) => (
  <ReactSelect<T, false>
    unstyled
    value={value ?? null}
    options={options}
    onChange={(option) => option && onChange(option)}
    menuPortalTarget={document.body}
    menuPosition="fixed"
    className={clsx("min-w-0", className)}
    styles={{ menuPortal: (base) => ({ ...base, zIndex: 60 }) }}
    classNames={{
      control: ({ isFocused, isDisabled }) =>
        clsx(
          "!min-h-9 rounded-lg border bg-surface-sunken px-3 text-sm transition-colors",
          isFocused ? "border-accent/70 ring-2 ring-accent/20" : "border-line hover:border-fg-subtle/50",
          isDisabled && "opacity-60",
        ),
      valueContainer: () => "gap-1",
      singleValue: () => "text-fg",
      placeholder: () => "text-fg-subtle",
      input: () => "text-fg",
      indicatorsContainer: () => "text-fg-subtle",
      dropdownIndicator: ({ isFocused }) => clsx("pl-2 transition-colors", isFocused ? "text-fg" : "hover:text-fg"),
      indicatorSeparator: () => "hidden",
      menu: () => "mt-1.5 overflow-hidden rounded-xl border border-line bg-surface-raised p-1 shadow-pop animate-scale-in",
      menuList: () => "max-h-72",
      option: ({ isFocused, isSelected }) =>
        clsx(
          "cursor-pointer rounded-md px-2.5 py-1.5 text-[13px]",
          isSelected ? "bg-accent/15 font-medium text-accent" : isFocused ? "bg-surface-sunken text-fg" : "text-fg-muted",
        ),
      noOptionsMessage: () => "px-2.5 py-2 text-fg-subtle",
    }}
    {...props}
  />
);
