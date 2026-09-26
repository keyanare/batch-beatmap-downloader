import React from "react";
import { DropdownValue, TInputItemDropdown } from "../../../../models/simple";
import { Select } from "../../ui/Select";
import { Field } from "./InputItem";

interface DropdownInputProps {
  item: TInputItemDropdown;
  value: DropdownValue;
  onChange: (value: DropdownValue) => void;
}

export const DropdownInput = ({ item, value, onChange }: DropdownInputProps) => {
  const unset = value.option.value === item.empty && !value.not;
  return (
    <Field
      label={item.label}
      hint={
        <button
          type="button"
          onClick={() => onChange({ ...value, not: !value.not })}
          disabled={value.option.value === item.empty}
          className={
            value.not
              ? "rounded px-1.5 text-2xs font-semibold text-danger ring-1 ring-danger/30"
              : "rounded px-1.5 text-2xs font-medium text-fg-subtle hover:text-fg disabled:invisible"
          }
          title="Exclude this value instead"
        >
          {value.not ? "is not" : "is"}
        </button>
      }
    >
      <Select
        value={value.option}
        options={item.options}
        onChange={(option) => onChange({ not: value.not && option.value !== item.empty, option })}
      />
      {item.warning && unset && <span className="text-2xs text-warning">{item.warning}</span>}
    </Field>
  );
};
