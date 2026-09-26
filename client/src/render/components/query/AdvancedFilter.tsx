import React from "react";
import { Group } from "../../../models/filter";
import { QueryGroup } from "./advanced/QueryGroup";

interface AdvancedFilterProps {
  group: Group;
  onChange: (group: Group) => void;
}

export const AdvancedFilter = ({ group, onChange }: AdvancedFilterProps) => (
  <div className="flex flex-col gap-3">
    <p className="text-xs text-fg-subtle">
      Combine rules with AND / OR, negate them with NOT and nest groups for anything the simple mode can't express.
    </p>
    <QueryGroup group={group} onChange={onChange} />
  </div>
);
