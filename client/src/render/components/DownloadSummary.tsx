import clsx from "clsx";
import { CircleAlert, ListPlus, Pause, Play, RotateCcw, Trash } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-toastify";
import { DownloadInfo } from "../../models/ipc";
import { remainingOf } from "../context/DownloadProvider";
import { formatBytes, formatDuration, formatNumber, formatRelative, formatSpeed } from "../util/format";
import { Badge, Tone } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Confirm } from "./ui/Modal";
import { Progress } from "./ui/Progress";

const states: Record<DownloadInfo["state"], { label: string; tone: Tone }> = {
  running: { label: "Downloading", tone: "accent" },
  paused: { label: "Paused", tone: "neutral" },
  waiting: { label: "Waiting for server", tone: "warning" },
  finished: { label: "Finished", tone: "success" },
};

const Count = ({ label, value, tone }: { label: string; value: number; tone?: string }) => (
  <div className="flex items-baseline gap-1.5">
    <span className={clsx("text-[13px] font-semibold tabular-nums", tone)}>{formatNumber(value)}</span>
    <span className="text-xs text-fg-subtle">{label}</span>
  </div>
);

const run = async (action: () => Promise<void>, message?: string) => {
  try {
    await action();
    if (message) toast.success(message);
  } catch (error) {
    toast.error((error as Error).message);
  }
};

export const DownloadSummary = ({ download }: { download: DownloadInfo }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remaining = remainingOf(download);
  const processed = download.total - remaining;
  const progress = download.total ? processed / download.total : 1;
  const state = states[download.state];
  const running = download.state === "running";
  const finished = download.state === "finished";

  const bytesLeft = Math.max(0, download.totalBytes - download.downloadedBytes);
  const eta = running && download.speed > 0 && bytesLeft > 0 ? formatDuration((bytesLeft / download.speed) * 1000) : null;

  return (
    <div className="animate-fade-in rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-mono text-[13px] font-semibold" title={download.name}>
              {download.name}
            </h3>
            <Badge tone={state.tone} dot={running}>
              {state.label}
            </Badge>
            {download.force && <Badge>Redownloading owned</Badge>}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-fg-subtle">
            <span>Started {formatRelative(download.createdAt)}</span>
            {download.collectionName && (
              <span className="flex items-center gap-1">
                · <ListPlus size={12} /> {download.collectionName}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {download.failed > 0 && (
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => run(() => window.electron.retryFailed(download.id))}>
              Retry failed
            </Button>
          )}
          {!finished &&
            (running || download.state === "waiting" ? (
              <Button size="sm" variant="secondary" icon={Pause} onClick={() => run(() => window.electron.pauseDownload(download.id))}>
                Pause
              </Button>
            ) : (
              <Button size="sm" variant="primary" icon={Play} onClick={() => run(() => window.electron.resumeDownload(download.id))}>
                Resume
              </Button>
            ))}
          <Button
            size="sm"
            variant="ghost"
            icon={Trash}
            title={finished ? "Remove from list" : "Cancel download"}
            onClick={() => (finished ? run(() => window.electron.deleteDownload(download.id)) : setConfirmDelete(true))}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Progress
          value={progress}
          active={running}
          tone={finished ? (download.failed ? "warning" : "success") : download.state === "running" ? "accent" : "muted"}
        />
        <span className="w-10 text-right text-xs font-semibold tabular-nums text-fg-muted">{Math.floor(progress * 100)}%</span>
      </div>

      {download.error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-warning">
          <CircleAlert size={14} /> {download.error}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <Count label="downloaded" value={download.completed} />
          {remaining > 0 && <Count label="left" value={remaining} />}
          {download.skipped > 0 && <Count label="already had" value={download.skipped} />}
          {download.failed > 0 && <Count label="failed" value={download.failed} tone="text-danger" />}
        </div>
        <div className="flex items-center gap-4 text-xs tabular-nums text-fg-subtle">
          <span>
            {formatBytes(download.downloadedBytes)}
            {!finished && ` of ${formatBytes(download.totalBytes)}`}
          </span>
          {running && <span className="font-medium text-fg-muted">{formatSpeed(download.speed)}</span>}
          {eta && <span>{eta} left</span>}
        </div>
      </div>

      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Cancel this download?"
        message={`${formatNumber(remaining)} beatmap sets haven't been downloaded yet. Maps that finished stay in your library.`}
        confirmLabel="Cancel download"
        danger
        onConfirm={() => run(() => window.electron.deleteDownload(download.id), "Download cancelled")}
      />
    </div>
  );
};
