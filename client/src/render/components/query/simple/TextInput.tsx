import React, { useEffect, useRef, useState } from "react";
import { TInputItemText } from "../../../../models/simple";
import { TextInput as Input } from "../../ui/Input";
import { Field } from "./InputItem";

interface TextInputProps {
  item: TInputItemText;
  value: string;
  onChange: (value: string) => void;
}

export const TextInput = ({ item, value, onChange }: TextInputProps) => {
  // Typing shouldn't rebuild the filter on every key press
  const [draft, setDraft] = useState(value);
  const emitted = useRef(value);

  // Only take outside changes, not the echo of what we just sent (which could be behind the user's typing)
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setDraft(value);
    }
  }, [value]);

  useEffect(() => {
    if (draft === emitted.current) return;
    const timeout = setTimeout(() => {
      emitted.current = draft;
      onChange(draft);
    }, 400);
    return () => clearTimeout(timeout);
  }, [draft, onChange]);

  return (
    <Field label={item.label}>
      <Input value={draft} onChange={setDraft} placeholder={item.placeholder} />
    </Field>
  );
};
