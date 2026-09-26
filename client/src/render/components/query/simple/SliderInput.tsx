import Slider from "rc-slider";
import React, { useEffect, useState } from "react";
import { TInputItemSlider } from "../../../../models/simple";
import { Field } from "./InputItem";

interface SliderInputProps {
  item: TInputItemSlider;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}

const format = (value: number) => (Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1));

export const SliderInput = ({ item, value, onChange }: SliderInputProps) => {
  // Local while dragging, the filter only updates once the handle is released
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const [min, max] = draft;
  const active = min > item.min || max < item.max;

  return (
    <Field
      label={item.label}
      hint={
        <span className={active ? "text-2xs font-semibold tabular-nums text-accent" : "text-2xs tabular-nums text-fg-subtle"}>
          {active ? `${format(min)} – ${format(max)}` : "Any"}
        </span>
      }
    >
      <div className="flex h-9 items-center px-2">
        <Slider
          range
          min={item.min}
          max={item.max}
          step={item.step}
          value={draft}
          allowCross={false}
          onChange={(next) => setDraft(next as [number, number])}
          onChangeComplete={(next) => onChange(next as [number, number])}
        />
      </div>
    </Field>
  );
};
