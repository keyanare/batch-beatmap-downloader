import { ChevronDown, CloudDownload, RefreshCcwDot, SearchCheck } from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { MapUpdateCheck } from "../../models/ipc";
import { useLibrary } from "../context/LibraryProvider";
import { formatBytes, formatNumber, plural } from "../util/format";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Callout } from "./ui/Misc";

export const MapUpdates = () => {
  const navigate = useNavigate();
  const { library } = useLibrary();
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<MapUpdateCheck | null>(null);
  const [expanded, setExpanded] = useState(false);

  const lazer = library?.client === "lazer";
  // stable would show the old and new versions side by side
  const blocked = !lazer && Boolean(library?.running);

  const check = async () => {
    setChecking(true);
    setResult(null);
    setExpanded(false);
    try {
      setResult(await window.electron.checkMapUpdates());
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setChecking(false);
    }
  };

  const update = async () => {
    setStarting(true);
    try {
      if (await window.electron.downloadMapUpdates()) navigate("/downloads");
      else setStarting(false);
    } catch (error) {
      toast.error((error as Error).message);
      setStarting(false);
    }
  };

  const notes = result
    ? [
        `Checked ${plural(result.checked, "set")}`,
        result.unchecked > 0 && `${formatNumber(result.unchecked)} couldn't be checked, try again later`,
        result.edited > 0 && `${formatNumber(result.edited)} you edited were left alone`,
      ].filter(Boolean)
    : [];

  return (
    <Card
      title="Map updates"
      description="Finds maps that got a newer version on the website and updates them all at once"
      icon={RefreshCcwDot}
      actions={
        <Button icon={SearchCheck} loading={checking} onClick={check}>
          Check for updates
        </Button>
      }
    >
      {result && (
        <div className="flex animate-fade-in flex-col gap-3">
          <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-sunken px-4 py-3">
            <div className="text-[13px] leading-6">
              <div className="font-medium">
                {result.updates.length
                  ? `${plural(result.updates.length, "beatmap set")} can be updated (${formatBytes(result.totalSize)})`
                  : "Everything's up to date"}
              </div>
              <div className="text-xs text-fg-subtle">{notes.join(", ")}</div>
            </div>
            {result.updates.length > 0 && (
              <Button variant="primary" icon={CloudDownload} loading={starting} disabled={blocked} onClick={update}>
                Update all
              </Button>
            )}
          </div>

          {result.updates.length > 0 && (
            <>
              <button
                type="button"
                className="flex items-center gap-1 self-start text-xs font-medium text-fg-muted hover:text-fg"
                onClick={() => setExpanded(!expanded)}
              >
                <ChevronDown size={14} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
                {expanded ? "Hide the list" : "Show which maps"}
              </button>
              {expanded && (
                <ul className="max-h-64 animate-fade-in overflow-y-auto rounded-xl border border-line text-[13px]">
                  {result.updates.map((set) => (
                    <li
                      key={set.setId}
                      className="flex items-center justify-between gap-3 border-b border-line px-4 py-2 last:border-b-0"
                    >
                      <span className="min-w-0 truncate">
                        {set.artist} - {set.title}
                        <span className="text-fg-subtle"> ({set.creator})</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-fg-subtle">{formatBytes(set.size)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {blocked ? (
                <Callout tone="warning">Close osu! first, otherwise it shows the old and the new versions side by side.</Callout>
              ) : (
                <p className="text-xs leading-5 text-fg-subtle">
                  {lazer
                    ? "osu!lazer swaps in the new versions by itself and keeps your scores. Collections are moved over to the new versions once you close the game."
                    : "The old versions are moved to the bbd-old-versions folder next to Songs, and collections are moved over to the new versions. If osu! still lists the old ones, press F5 in song select."}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
};
