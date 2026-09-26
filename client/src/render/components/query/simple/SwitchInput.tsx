import React from "react";
import { TInputItemSwitch } from "../../../../models/simple";
import { Segmented } from "../../ui/Segmented";
import { Field } from "./InputItem";

interface SwitchInputProps {
  item: TInputItemSwitch;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
}

type Choice = "any" | "yes" | "no";

export const SwitchInput = ({ item, value, onChange }: SwitchInputProps) => {
  const choice: Choice = value === undefined ? "any" : value ? "yes" : "no";
  return (
    <Field label={item.label}>
      <div>
        <Segmented<Choice>
          value={choice}
          onChange={(next) => onChange(next === "any" ? undefined : next === "yes")}
          options={[
            { value: "any", label: "Any" },
            { value: "yes", label: "Only" },
            { value: "no", label: "Exclude" },
          ]}
        />
      </div>
    </Field>
  );
};
