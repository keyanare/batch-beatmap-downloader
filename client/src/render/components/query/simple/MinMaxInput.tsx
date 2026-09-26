import React from "react";
import { MinMax, TInputItemMinMax } from "../../../../models/simple";
import { NumberInput } from "../../ui/Input";
import { Field } from "./InputItem";

interface MinMaxInputProps {
  item: TInputItemMinMax;
  value: MinMax;
  onChange: (value: MinMax) => void;
}

export const MinMaxInput = ({ item, value, onChange }: MinMaxInputProps) => {
  const [min, max] = value;
  const inverted = min !== null && max !== null && min > max;

  return (
    <Field
      label={item.label}
      hint={inverted ? <span className="text-2xs text-danger">Min is above max</span> : item.unit && <span className="text-2xs text-fg-subtle">{item.unit}</span>}
    >
      <div className="flex items-center gap-2">
        <NumberInput placeholder="Min" value={min} onChange={(next) => onChange([next, max])} />
        <span className="text-fg-subtle">–</span>
        <NumberInput placeholder="Max" value={max} onChange={(next) => onChange([min, next])} />
      </div>
    </Field>
  );
};
