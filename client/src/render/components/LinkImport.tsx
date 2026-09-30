import { CircleAlert, Link2, Search } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-toastify";
import { LinkLookup, UserMapList } from "../../models/ipc";
import { formatNumber, plural } from "../util/format";
import { DownloadSettings } from "./DownloadSettings";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Segmented } from "./ui/Segmented";

const userLists: { value: UserMapList; label: string }[] = [
  { value: "maps", label: "Their maps" },
  { value: "favourites", label: "Favourites" },
  { value: "best", label: "Top plays" },
];

const PROFILE_LINK = /ppy\.sh\/(?:users|u)\/[^\s/]+/i;

const examples = [
  "osucollector.com/collections/…",
  "osucollector.com/tournaments/…",
  "osu.ppy.sh/beatmapsets/…",
  "osu.ppy.sh/community/matches/…",
  "osu.ppy.sh/users/…",
];

export const LinkImport = () => {
  const [text, setText] = useState("");
  const [list, setList] = useState<UserMapList>("maps");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LinkLookup | null>(null);

  const lookup = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      setResult(await window.electron.lookupLinks(text, list));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const notes = result
    ? [
        result.notOnServer > 0 &&
          `${plural(result.notOnServer, "set")} aren't on the server and will come from mirrors (not counted in the size)`,
        result.unresolved > 0 && `${formatNumber(result.unresolved)} beatmaps couldn't be found`,
      ].filter((note): note is string => Boolean(note))
    : [];

  return (
    <Card
      title="Add maps from links"
      icon={Link2}
      description="osu!collector collections and tournaments, beatmap links from a mappool, multiplayer matches or player profiles"
    >
      <div className="flex flex-col gap-3">
        <textarea
          className="field h-auto min-h-[76px] resize-y py-2 font-mono text-[13px] leading-5"
          spellCheck={false}
          value={text}
          placeholder={`Paste one or more links, for example\n${examples.join("\n")}`}
          rows={3}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) lookup();
          }}
        />
        <div className="flex items-center justify-between gap-3">
          {PROFILE_LINK.test(text) ? (
            <Segmented size="sm" value={list} options={userLists} onChange={setList} />
          ) : (
            <span className="text-xs text-fg-subtle">Anything else in the text is ignored, so whole forum posts or spreadsheets work too</span>
          )}
          <Button icon={Search} loading={loading} disabled={!text.trim()} onClick={lookup}>
            Look up
          </Button>
        </div>
      </div>

      {result && (
        <div className="mt-5 flex animate-fade-in flex-col gap-4 border-t border-line pt-5">
          <div>
            <div className="text-[15px] font-semibold">{result.title}</div>
            {notes.map((note) => (
              <div key={note} className="mt-1 flex items-center gap-1.5 text-xs text-warning">
                <CircleAlert size={13} /> {note}
              </div>
            ))}
          </div>
          <DownloadSettings
            key={result.summary.id}
            summary={result.summary}
            collectionName={result.collectionName}
            source="these links"
          />
        </div>
      )}
    </Card>
  );
};
