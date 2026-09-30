import { Database, FileArchive, FolderOpen, FolderInput, Gamepad2, Import, Library, RefreshCw, RotateCcw } from "lucide-react";
import React, { useState } from "react";
import { LibraryStatus } from "../../models/ipc";
import { useLibrary } from "../context/LibraryProvider";
import { useSettings } from "../context/SettingsProvider";
import { formatNumber, plural } from "../util/format";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Callout } from "./ui/Misc";

const useProcessPending = () => {
  const [busy, setBusy] = useState(false);
  const process = async () => {
    setBusy(true);
    try {
      await window.electron.processPending();
    } finally {
      setTimeout(() => setBusy(false), 1500);
    }
  };
  return { busy, process };
};

const OpenFolder = ({ path }: { path: string }) => (
  <Button size="sm" variant="ghost" icon={FolderOpen} onClick={() => window.electron.openPath(path)}>
    Open folder
  </Button>
);

const LazerImports = ({ library }: { library: LibraryStatus }) => {
  const { settings } = useSettings();
  const { busy, process } = useProcessPending();
  const autoImport = settings?.lazerAutoImport ?? true;
  const queued = library.importing;
  const waiting = Math.max(0, library.pending - queued - library.failedImports);
  // Without auto import the waiting ones only go in when asked to
  const importing = queued + (autoImport ? waiting : 0);

  return (
    <>
      {library.running && (importing > 0 || waiting > 0) && (
        <Callout
          tone="info"
          title={
            importing > 0
              ? `osu!lazer is importing ${plural(importing, "beatmap set")}`
              : `${plural(waiting, "beatmap set")} waiting to be imported`
          }
          action={
            <>
              <OpenFolder path={library.downloadDir} />
              {!autoImport && waiting > 0 && (
                <Button size="sm" variant="primary" icon={Import} loading={busy} onClick={process}>
                  Import now
                </Button>
              )}
            </>
          }
        >
          {autoImport
            ? waiting > 0
              ? `${formatNumber(queued)} in the game's queue, the other ${formatNumber(waiting)} follow as it gets through them. `
              : ""
            : queued > 0 && waiting > 0
              ? `${formatNumber(queued)} in the game's queue, ${formatNumber(waiting)} more waiting. `
              : ""}
          {importing > 0 ? "The game pauses imports while you're playing." : "Automatic import is off in settings."}
        </Callout>
      )}

      {!library.running && library.pending - library.failedImports > 0 && (
        <Callout
          tone="info"
          title={`${plural(library.pending - library.failedImports, "beatmap set")} waiting to be imported`}
          action={
            <>
              <OpenFolder path={library.downloadDir} />
              {library.canLaunch && (
                <Button size="sm" variant="primary" icon={Import} loading={busy} onClick={process}>
                  Start osu!lazer & import
                </Button>
              )}
            </>
          }
        >
          They'll be imported next time osu!lazer is open.
        </Callout>
      )}

      {library.failedImports > 0 && (
        <Callout
          tone="warning"
          title={`osu!lazer couldn't import ${plural(library.failedImports, "beatmap set")}`}
          action={
            <>
              <OpenFolder path={library.downloadDir} />
              {(library.running || library.canLaunch) && (
                <Button size="sm" variant="secondary" icon={RotateCcw} loading={busy} onClick={process}>
                  Retry
                </Button>
              )}
            </>
          }
        >
          The game went on with later maps but these are still here. Its notifications or logs say why.
        </Callout>
      )}
    </>
  );
};

const StableTempFolder = ({ library }: { library: LibraryStatus }) => {
  const { busy, process } = useProcessPending();
  if (library.pending === 0) return null;
  return (
    <Callout
      tone="info"
      title={`${plural(library.pending, "beatmap set")} in the temporary folder`}
      action={
        <>
          <OpenFolder path={library.downloadDir} />
          <Button size="sm" variant="primary" icon={FolderInput} loading={busy} onClick={process}>
            Move to Songs
          </Button>
        </>
      }
    >
      Move them into your Songs folder whenever you're ready.
    </Callout>
  );
};

/** Banners for things waiting to get into the game: downloaded files and collections. */
export const PendingNotices = () => {
  const { library } = useLibrary();
  if (!library?.valid) return null;

  const lazer = library.client === "lazer";
  const game = lazer ? "osu!lazer" : "osu!";

  return (
    <>
      {library.warning && <Callout tone="warning">{library.warning}</Callout>}

      {lazer ? <LazerImports library={library} /> : <StableTempFolder library={library} />}

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
