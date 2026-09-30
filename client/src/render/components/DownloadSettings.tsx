import { Download, ListPlus } from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { SearchSummary } from "../../models/ipc";
import { useLibrary } from "../context/LibraryProvider";
import { formatBytes, formatNumber, plural } from "../util/format";
import { Button } from "./ui/Button";
import { TextInput } from "./ui/Input";
import { Callout } from "./ui/Misc";
import { Toggle } from "./ui/Toggle";

interface DownloadSettingsProps {
  summary: SearchSummary;
  /** Turns "Add to a collection" on with this name. */
  collectionName?: string;
  /** What the maps are, for the collection description. */
  source?: string;
}

const Figure = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div>
    <div className="text-2xs font-semibold uppercase tracking-wider text-fg-subtle">{label}</div>
    <div className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">{value}</div>
  </div>
);

export const DownloadSettings = ({ summary, collectionName: suggestedName, source = "this search" }: DownloadSettingsProps) => {
  const navigate = useNavigate();
  const { library } = useLibrary();
  const [force, setForce] = useState(false);
  const [collection, setCollection] = useState(Boolean(suggestedName));
  const [collectionName, setCollectionName] = useState(suggestedName ?? "");
  const [starting, setStarting] = useState(false);

  const owned = summary.sets - summary.newSets;
  const sets = force ? summary.sets : summary.newSets;
  const size = force ? summary.totalSize : summary.newSize;
  const nameMissing = collection && collectionName.trim() === "";
  const game = library?.client === "lazer" ? "osu!lazer" : "osu!";

  // Everything is already downloaded, but a collection can still be made
  const collectionOnly = sets === 0 && collection;

  const start = async () => {
    setStarting(true);
    try {
      const download = await window.electron.downloadSearch(summary.id, {
        force,
        collectionName: collection ? collectionName.trim() : undefined,
      });
      if (download) {
        toast.success(`Downloading ${plural(sets, "beatmap set")}`);
        navigate("/downloads");
      } else {
        setStarting(false);
      }
    } catch (error) {
      toast.error((error as Error).message);
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-4">
        <Figure label="Beatmaps" value={formatNumber(summary.beatmaps)} />
        <Figure label="Sets" value={formatNumber(summary.sets)} />
        <Figure label="Already have" value={formatNumber(owned)} />
        <Figure label="Download size" value={formatBytes(size)} />
      </div>

      <div className="flex flex-col divide-y divide-line rounded-xl border border-line">
        {owned > 0 && (
          <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
            <div>
              <div className="text-[13px] font-medium">Download maps I already have</div>
              <div className="text-xs text-fg-subtle">Replaces {plural(owned, "set")} in your library with fresh copies</div>
            </div>
            <Toggle checked={force} onChange={setForce} />
          </label>
        )}
        <div className="flex flex-col gap-3 px-4 py-3">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <div className="text-[13px] font-medium">Add to a collection</div>
              <div className="text-xs text-fg-subtle">
                All {plural(summary.beatmaps, "beatmap")} from {source}, including ones you already have
              </div>
            </div>
            <Toggle checked={collection} onChange={setCollection} />
          </label>
          {collection && (
            <div className="flex animate-fade-in flex-col gap-2">
              <TextInput
                icon={ListPlus}
                value={collectionName}
                onChange={setCollectionName}
                placeholder="Collection name"
                autoFocus
              />
              {library?.running && (
                <Callout tone="warning">
                  {game} is open, so the collection will be created once you close it.
                </Callout>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {sets === 0 && <span className="text-[13px] text-fg-subtle">You already have every set from {source}</span>}
        <Button
          variant="primary"
          size="lg"
          icon={collectionOnly ? ListPlus : Download}
          loading={starting}
          disabled={(sets === 0 && !collection) || nameMissing}
          onClick={start}
        >
          {collectionOnly ? "Create collection" : `Download ${plural(sets, "set")}`}
        </Button>
      </div>
    </div>
  );
};
