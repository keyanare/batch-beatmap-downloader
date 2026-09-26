import React from "react";
import { defaultOperatorsMap, defaultValuesMap, inputOptions, Rule, RuleType } from "../../../../models/rules";
import { Select } from "../../ui/Select";

interface RuleSelectorProps {
  rule: Rule;
  onChange: (rule: Rule) => void;
}

export const RuleSelector = ({ rule, onChange }: RuleSelectorProps) => (
  <Select
    className="w-48"
    value={inputOptions.find((option) => option.value === rule.field)}
    options={inputOptions}
    onChange={(option) => {
      if (option.value === rule.field) return;
      const type = option.type ?? RuleType.TEXT;
      onChange({
        field: option.value,
        type,
        value: type === RuleType.DATE ? String(Date.now()) : defaultValuesMap[type],
        operator: defaultOperatorsMap[type],
      });
    }}
  />
);
