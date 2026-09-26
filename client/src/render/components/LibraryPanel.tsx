import { Database, FileArchive, FolderOpen, FolderInput, Gamepad2, Import, Library, RefreshCw } from "lucide-react";
import React, { useState } from "react";
import { useLibrary } from "../context/LibraryProvider";
import { formatNumber, plural } from "../util/format";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Callout } from "./ui/Misc";

/** Banners for things waiting to get into the game: downloaded files and collections. */
export const PendingNotices = () => {
  const { library } = useLibrary();
  const [busy, setBusy] = useState(false);
  if (!library?.valid) return null;

  const lazer = library.client === "lazer";
  const game = lazer ? "osu!lazer" : "osu!";

  const process = async () => {
    setBusy(true);
    try {
      await window.electron.processPending();
    } finally {
      setTimeout(() => setBusy(false), 1500);
    }
  };

  return (
    <>
      {library.warning && <Callout tone="warning">{library.warning}</Callout>}

      {library.pending > 0 && (
        <Callout
          tone="info"
          title={
            lazer
              ? `${plural(library.pending, "beatmap set")} waiting to be imported`
              : `${plural(library.pending, "beatmap set")} in the temporary folder`
          }
          action={
            <>
              <Button size="sm" variant="ghost" icon={FolderOpen} onClick={() => window.electron.openPath(library.downloadDir)}>
                Open folder
              </Button>
              {(!lazer || library.running || library.canLaunch) && (
                <Button size="sm" variant="primary" icon={lazer ? Import : FolderInput} loading={busy} onClick={process}>
                  {lazer ? (library.running ? "Import now" : "Start osu!lazer & import") : "Move to Songs"}
                </Button>
              )}
            </>
          }
        >
          {lazer
            ? library.running
              ? "osu!lazer is running, they'll be imported automatically in a moment."
              : "They'll be imported next time osu!lazer is open."
            : "Move them into your Songs folder whenever you're ready."}
        </Callout>
      )}

      {library.pendingCollections.length > 0 && (
        <Callout
          tone="warning"
          title={`Close ${game} to finish creating ${library.pendingCollections.length === 1 ? "a collection" : "collections"}`}
          action={
            <Button size="sm" variant="ghost" onClick={() => window.electron.discardPendingCollections()}>
              Discard
            </Button>
          }
        >
          {game} would overwrite changes made while it's open, so{" "}
          {library.pendingCollections.map((name) => `"${name}"`).join(", ")} will be created as soon as it's closed.
        </Callout>
      )}
    </>
  );
};

export const LibraryPanel = () => {
  const { library, loading, refresh } = useLibrary();
  if (!library) return null;

  const lazer = library.client === "lazer";

  return (
    <Card
      title="Your library"
      icon={Library}
      description={<span className="block truncate" title={library.path}>{library.path}</span>}
      actions={
        <>
          <Button variant="ghost" icon={FolderOpen} onClick={() => window.electron.openPath(library.path)} title="Open folder" />
          <Button variant="ghost" icon={RefreshCw} loading={loading} onClick={refresh} title="Rescan" />
        </>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-surface-sunken px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <Gamepad2 size={13} /> Game
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[15px] font-semibold">{lazer ? "osu!lazer" : "osu!stable"}</span>
            {library.running ? (
              <Badge tone="success" dot>
                Running
              </Badge>
            ) : (
              <Badge>Closed</Badge>
            )}
          </div>
        </div>
        <div className="rounded-xl bg-surface-sunken px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <Database size={13} /> Beatmap sets
          </div>
          <div className="mt-1 text-[15px] font-semibold tabular-nums">{formatNumber(library.setCount)}</div>
        </div>
        <div className="rounded-xl bg-surface-sunken px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-fg-subtle">
            <FileArchive size={13} /> {lazer ? "Waiting for import" : "In temp folder"}
          </div>
          <div className="mt-1 text-[15px] font-semibold tabular-nums">{formatNumber(library.pending)}</div>
        </div>
      </div>
    </Card>
  );
};
