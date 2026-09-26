import clsx from "clsx";
import { CornerDownLeft, Keyboard } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Group } from "../../../models/filter";
import {
  aboveSection,
  getValue,
  InputType,
  ItemValue,
  sections,
  setValue,
  TInputItem,
  textToTree,
  treeToText,
} from "../../../models/simple";
import { useStickyState } from "../../hooks/useStickyState";
import InputItem from "./simple/InputItem";

interface SimpleFilterProps {
  group: Group;
  onChange: (group: Group) => void;
}

const QuickQuery = ({ group, onChange }: SimpleFilterProps) => {
  const text = treeToText(group);
  const [draft, setDraft] = useState(text);
  const [unknown, setUnknown] = useState<string[]>([]);
  const focused = useRef(false);

  // Mirror changes made through the form, unless the user is typing here
  useEffect(() => {
    if (!focused.current) setDraft(text);
  }, [text]);

  const apply = () => {
    const parsed = textToTree(draft);
    setUnknown(parsed.unknown);
    onChange(parsed.group);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Keyboard size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
        <input
          className="field h-10 pl-9 pr-24 font-mono text-[13px]"
          spellCheck={false}
          value={draft}
          placeholder="status=r mode=o stars>=5 artist=camellia"
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false;
            if (draft !== text) apply();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") apply();
            if (event.key === "Escape") setDraft(text);
          }}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-2xs text-fg-subtle">
          <CornerDownLeft size={12} /> to apply
        </span>
      </div>
      {unknown.length > 0 ? (
        <span className="text-xs text-warning">Didn't understand: {unknown.join(", ")}</span>
      ) : (
        <span className="text-xs text-fg-subtle">
          The same search terms as osu!, plus artist=, mapper=, genre=, farm=yes and more. Or use the fields below.
        </span>
      )}
    </div>
  );
};

const countActive = (group: Group, items: TInputItem[]) =>
  items.filter((item) => {
    const value = getValue(group, item);
    if (Array.isArray(value)) {
      if (item.type === InputType.SLIDER) return value[0] !== item.min || value[1] !== item.max;
      return value[0] !== null || value[1] !== null;
    }
    if (typeof value === "string") return value !== "";
    if (typeof value === "object") return value.option.value !== (item.type === InputType.DROPDOWN ? item.empty : "") || value.not;
    return value !== undefined;
  }).length;

export const SimpleFilter = ({ group, onChange }: SimpleFilterProps) => {
  const [tab, setTab] = useStickyState(sections[0].title, "simple-tab");
  const section = sections.find((item) => item.title === tab) ?? sections[0];

  // Fields call this with the latest group, so quick consecutive changes don't overwrite each other
  const groupRef = useRef(group);
  groupRef.current = group;
  const change = useCallback(
    (item: TInputItem, value: ItemValue) => onChange(setValue(groupRef.current, item, value)),
    [onChange],
  );

  return (
    <div className="flex flex-col gap-5">
      <QuickQuery group={group} onChange={onChange} />

      <div className="grid grid-cols-2 gap-4">
        {aboveSection.items.map((item) => (
          <InputItem key={item.key} item={item} value={getValue(group, item)} onChange={(value) => change(item, value)} />
        ))}
      </div>

      <div>
        <div className="flex gap-1 border-b border-line">
          {sections.map((item) => {
            const active = countActive(group, item.items);
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => setTab(item.title)}
                className={clsx(
                  "-mb-px flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-[13px] font-medium transition-colors",
                  item.title === section.title
                    ? "border-accent text-fg"
                    : "border-transparent text-fg-subtle hover:text-fg",
                )}
              >
                {item.title}
                {active > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-2xs font-semibold text-white">
                    {active}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div key={section.title} className="grid animate-fade-in grid-cols-2 gap-x-6 gap-y-5 pt-5">
          {section.items.map((item) => (
            <InputItem key={item.key} item={item} value={getValue(group, item)} onChange={(value) => change(item, value)} />
          ))}
        </div>
      </div>
    </div>
  );
};
