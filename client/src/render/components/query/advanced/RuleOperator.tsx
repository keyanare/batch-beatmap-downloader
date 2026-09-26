import React from "react";
import { operatorMap, Rule, RuleType } from "../../../../models/rules";
import { Select } from "../../ui/Select";

interface RuleOperatorProps {
  rule: Rule;
  onChange: (rule: Rule) => void;
}

export const RuleOperator = ({ rule, onChange }: RuleOperatorProps) => {
  const options = operatorMap[rule.type as RuleType] ?? [];
  return (
    <Select
      className="w-56"
      isSearchable={false}
      value={options.find((option) => option.value === rule.operator) ?? options[0]}
      options={options}
      onChange={(option) => onChange({ ...rule, operator: option.value })}
    />
  );
};
