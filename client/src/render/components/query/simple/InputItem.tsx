import React from "react";
import { InputType, ItemValue, TInputItem } from "../../../../models/simple";
import { DropdownInput } from "./DropdownInput";
import { MinMaxInput } from "./MinMaxInput";
import { SliderInput } from "./SliderInput";
import { SwitchInput } from "./SwitchInput";
import { TextInput } from "./TextInput";

interface InputItemProps {
  item: TInputItem;
  value: ItemValue;
  onChange: (value: ItemValue) => void;
}

const InputItem = ({ item, value, onChange }: InputItemProps) => {
  switch (item.type) {
    case InputType.SLIDER:
      return <SliderInput item={item} value={value as [number, number]} onChange={onChange} />;
    case InputType.MIN_MAX:
      return <MinMaxInput item={item} value={value as [number | null, number | null]} onChange={onChange} />;
    case InputType.TEXT:
      return <TextInput item={item} value={value as string} onChange={onChange} />;
    case InputType.DROPDOWN:
      return <DropdownInput item={item} value={value as never} onChange={onChange} />;
    case InputType.SWITCH:
      return <SwitchInput item={item} value={value as boolean | undefined} onChange={onChange} />;
  }
};

export const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <div className="flex h-4 items-center justify-between">
      <span className="label">{label}</span>
      {hint}
    </div>
    {children}
  </div>
);

export default InputItem;
