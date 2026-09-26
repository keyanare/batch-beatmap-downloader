import React from "react";
import { Rule } from "../../../../models/rules";
import { RuleInput } from "./RuleInput";
import { RuleOperator } from "./RuleOperator";
import { RuleSelector } from "./RuleSelector";

interface FilterRuleProps {
  rule: Rule;
  onChange: (rule: Rule) => void;
}

export const FilterRule = ({ rule, onChange }: FilterRuleProps) => (
  <div className="flex flex-wrap items-center gap-2">
    <RuleSelector rule={rule} onChange={onChange} />
    <RuleOperator rule={rule} onChange={onChange} />
    <RuleInput rule={rule} onChange={onChange} />
  </div>
);
