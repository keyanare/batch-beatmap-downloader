import React from "react";
import { dropdownMap, InputType, inputTypeMap, Rule, RuleType } from "../../../../models/rules";
import { NumberInput, TextInput } from "../../ui/Input";
import { Select } from "../../ui/Select";

interface RuleInputProps {
  rule: Rule;
  onChange: (rule: Rule) => void;
}

const toDateInput = (ms: string) => {
  const date = new Date(Number(ms));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export const RuleInput = ({ rule, onChange }: RuleInputProps) => {
  const type = rule.type as RuleType;

  switch (inputTypeMap[type]) {
    case InputType.DROPDOWN: {
      const options = dropdownMap.get(type) ?? [];
      return (
        <Select
          className="w-44"
          value={options.find((option) => option.value === rule.value) ?? options[0]}
          options={options}
          onChange={(option) => onChange({ ...rule, value: option.value })}
        />
      );
    }
    case InputType.NUMBER:
      return (
        <NumberInput
          className="w-44"
          value={rule.value === "" || Number.isNaN(Number(rule.value)) ? null : Number(rule.value)}
          onChange={(value) => onChange({ ...rule, value: value === null ? "" : String(value) })}
        />
      );
    case InputType.DATE:
      return (
        <input
          type="date"
          className="field w-44"
          value={toDateInput(rule.value)}
          onChange={(event) => {
            const time = event.target.valueAsNumber;
            if (!Number.isNaN(time)) onChange({ ...rule, value: String(time) });
          }}
        />
      );
    default:
      return (
        <TextInput
          className="w-44"
          value={rule.value}
          placeholder="Value"
          onChange={(value) => onChange({ ...rule, value })}
        />
      );
  }
};
