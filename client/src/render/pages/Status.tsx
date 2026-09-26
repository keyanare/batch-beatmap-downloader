import { Activity, CalendarClock, CircleCheck, Download, Gauge, HardDrive, Heart, RefreshCw, Star, Trash, Users } from "lucide-react";
import React, { useEffect } from "react";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, PageHeader } from "../components/ui/Card";
import { EmptyState, Stat } from "../components/ui/Misc";
import { Progress, Skeleton } from "../components/ui/Progress";
import { useStatus } from "../context/StatusProvider";
import { formatBytes, formatDate, formatNumber, formatSpeed } from "../util/format";

const Line = ({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: React.ReactNode }) => (
  <div className="flex items-center gap-3 py-2">
    <Icon size={15} className="text-fg-subtle" />
    <span className="flex-1 text-[13px] text-fg-muted">{label}</span>
    <span className="text-[13px] font-semibold tabular-nums">{value}</span>
  </div>
);

export const Status = () => {
  const { online, loading, metrics, refresh } = useStatus();

  // Live numbers while this page is open
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const active = (metrics?.Download.CurrentDownloads ?? []).filter((download) => download.Active);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Server"
        description="Live stats from the Batch Beatmap Downloader server, shared by everyone using the app"
        actions={
          <>
            {!loading && (
              <Badge tone={online ? "success" : "danger"} dot>
                {online ? "Online" : "Offline"}
              </Badge>
            )}
            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={refresh} />
          </>
        }
      />

      {loading && !metrics ? (
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : !metrics ? (
        <EmptyState icon={Activity} title="The server can't be reached" description="It might be down for maintenance. Downloads resume automatically once it's back." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={Users} label="Active downloads" value={formatNumber(active.length)} />
            <Stat icon={Gauge} label="Bandwidth now" value={formatSpeed(metrics.Download.CurrentBandwidthUsage)} tone="info" />
            <Stat icon={Activity} label="Average last minute" value={formatSpeed(metrics.Download.AverageSpeedMinute)} tone="success" />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Card title="Database" icon={HardDrive}>
              <div className="divide-y divide-line">
                <Line icon={Star} label="Ranked beatmaps" value={formatNumber(metrics.Database.NumberStoredRanked)} />
                <Line icon={Heart} label="Loved beatmaps" value={formatNumber(metrics.Database.NumberStoredLoved)} />
                <Line icon={Trash} label="Unranked beatmaps" value={formatNumber(metrics.Database.NumberStoredUnranked)} />
                <Line icon={CalendarClock} label="Last beatmap added" value={formatDate(metrics.Database.LastBeatmapAdded)} />
              </div>
            </Card>
            <Card title="Today" icon={CalendarClock}>
              <div className="divide-y divide-line">
                <Line icon={Download} label="Beatmap sets downloaded" value={formatNumber(metrics.Download.DailyStats.Maps)} />
                <Line icon={HardDrive} label="Data served" value={formatBytes(metrics.Download.DailyStats.Size)} />
                <Line icon={CircleCheck} label="Downloads completed" value={formatNumber(metrics.Download.DailyStats.Completed)} />
                <Line icon={Gauge} label="Average speed" value={formatSpeed(metrics.Download.DailyStats.Speed)} />
              </div>
            </Card>
          </div>

          <Card title="Downloads in progress" description="Everyone's, anonymously" icon={Activity}>
            {active.length ? (
              <div className="flex flex-col gap-3">
                {active.map((download, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <div className="w-40 shrink-0 text-xs tabular-nums text-fg-muted">
                      {formatBytes(Math.max(0, download.Size - download.Progress))} left
                    </div>
                    <Progress value={download.Size ? download.Progress / download.Size : 0} active />
                    <div className="w-24 shrink-0 text-right text-xs tabular-nums text-fg-subtle">{formatSpeed(download.Speed)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-fg-subtle">Nobody is downloading right now.</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
