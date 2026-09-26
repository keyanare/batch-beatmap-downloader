import { ArrowDownWideNarrow } from "lucide-react";
import React from "react";
import { QueryOrder } from "../../../models/ipc";
import { NumberInput } from "../ui/Input";
import { Select } from "../ui/Select";
import { Toggle } from "../ui/Toggle";

interface QuerySettingsProps {
  limit: number | undefined;
  order: QueryOrder | undefined;
  onChange: (limit: number | undefined, order: QueryOrder | undefined) => void;
}

const orderOptions = [
  { value: "approvedDate", label: "Ranked date" },
  { value: "lastUpdate", label: "Last update" },
  { value: "stars", label: "Star rating" },
  { value: "bpm", label: "BPM" },
  { value: "favouriteCount", label: "Favourites" },
  { value: "playCount", label: "Play count" },
  { value: "passCount", label: "Pass count" },
  { value: "maxCombo", label: "Max combo" },
  { value: "hitLength", label: "Drain length" },
  { value: "totalLength", label: "Total length" },
  { value: "hp", label: "HP" },
  { value: "cs", label: "CS" },
  { value: "od", label: "OD" },
  { value: "ar", label: "AR" },
  { value: "size", label: "File size" },
  { value: "id", label: "Beatmap id" },
  { value: "setId", label: "Set id" },
];

const directionOptions = [
  { value: "DESC", label: "Highest first" },
  { value: "ASC", label: "Lowest first" },
];

const defaultOrder: QueryOrder = { by: "approvedDate", direction: "DESC" };

export const QuerySettings = ({ limit, order, onChange }: QuerySettingsProps) => {
  const enabled = limit !== undefined;
  const current = order ?? defaultOrder;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-fg-muted">
        <Toggle checked={enabled} onChange={(on) => onChange(on ? 100 : undefined, on ? defaultOrder : undefined)} />
        Only the first
      </label>
      {enabled && (
        <div className="flex animate-fade-in items-center gap-2">
          <NumberInput
            className="w-20"
            value={limit}
            onChange={(value) => onChange(value === null ? 1 : Math.max(1, Math.round(value)), current)}
          />
          <span className="text-[13px] text-fg-muted">beatmaps by</span>
          <Select
            className="w-40"
            value={orderOptions.find((option) => option.value === current.by)}
            options={orderOptions}
            onChange={(option) => onChange(limit, { ...current, by: option.value })}
          />
          <Select
            className="w-36"
            isSearchable={false}
            value={directionOptions.find((option) => option.value === current.direction)}
            options={directionOptions}
            onChange={(option) => onChange(limit, { ...current, direction: option.value })}
          />
          <ArrowDownWideNarrow size={15} className="text-fg-subtle" />
        </div>
      )}
    </div>
  );
};
