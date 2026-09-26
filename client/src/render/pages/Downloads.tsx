import { CircleCheck, Clock, Download, Gauge, Layers, Pause, Play, Search } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { DownloadSummary } from "../components/DownloadSummary";
import { PendingNotices } from "../components/LibraryPanel";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/Card";
import { EmptyState, Stat } from "../components/ui/Misc";
import { useDownloads } from "../context/DownloadProvider";
import { formatBytes, formatDuration, formatNumber, formatSpeed } from "../util/format";

export const Downloads = () => {
  const navigate = useNavigate();
  const { downloads, totals } = useDownloads();

  const active = downloads.filter((download) => download.state !== "finished");
  const finished = downloads.filter((download) => download.state === "finished");
  const anyPaused = active.some((download) => download.state === "paused");
  const eta = totals.running && totals.speed > 0 ? formatDuration((totals.bytesLeft / totals.speed) * 1000) : "–";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Downloads"
        description="Downloads carry on in the background while you use the rest of the app"
        actions={
          active.length > 0 && (
            <>
              {anyPaused && (
                <Button icon={Play} onClick={() => window.electron.resumeAll()}>
                  Resume all
                </Button>
              )}
              {totals.running > 0 && (
                <Button icon={Pause} onClick={() => window.electron.pauseAll()}>
                  Pause all
                </Button>
              )}
            </>
          )
        }
      />

      <PendingNotices />

      {downloads.length === 0 ? (
        <EmptyState
          icon={Download}
          title="Nothing downloading"
          description="Search for beatmaps or check your collections for missing maps to start a download."
          action={
            <Button variant="primary" icon={Search} onClick={() => navigate("/search")}>
              Search beatmaps
            </Button>
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              <Stat icon={Layers} label="Remaining" value={formatNumber(totals.remaining)} hint={`of ${formatNumber(totals.total)} sets`} />
              <Stat icon={Gauge} label="Speed" value={formatSpeed(totals.speed)} tone="info" />
              <Stat icon={Download} label="Left to download" value={formatBytes(totals.bytesLeft)} tone="warning" />
              <Stat icon={Clock} label="Time left" value={eta} tone="success" />
            </div>
          )}

          <div className="flex flex-col gap-3">
            {active.map((download) => (
              <DownloadSummary key={download.id} download={download} />
            ))}
          </div>

          {finished.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="mt-2 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold text-fg-muted">
                  <CircleCheck size={15} className="text-success" /> Finished
                </h2>
                <Button size="sm" variant="ghost" onClick={() => window.electron.clearFinished()}>
                  Clear
                </Button>
              </div>
              {finished.map((download) => (
                <DownloadSummary key={download.id} download={download} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
