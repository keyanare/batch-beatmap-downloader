import { CalendarClock, Heart, Server, Star, Trash } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { useStatus } from "../context/StatusProvider";
import { formatDate, formatNumber } from "../util/format";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Skeleton } from "./ui/Progress";

const Item = ({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: React.ReactNode }) => (
  <div className="flex items-center gap-3">
    <Icon size={15} className="text-fg-subtle" />
    <span className="flex-1 text-[13px] text-fg-muted">{label}</span>
    <span className="text-[13px] font-semibold tabular-nums">{value}</span>
  </div>
);

export const BasicStatus = () => {
  const { loading, online, metrics } = useStatus();

  return (
    <Card
      title="Beatmap server"
      icon={Server}
      actions={
        loading ? null : (
          <Badge tone={online ? "success" : "danger"} dot>
            {online ? "Online" : "Offline"}
          </Badge>
        )
      }
    >
      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
          <Skeleton className="h-4" />
        </div>
      ) : metrics ? (
        <div className="flex flex-col gap-2.5">
          <Item icon={Star} label="Ranked" value={formatNumber(metrics.Database.NumberStoredRanked)} />
          <Item icon={Heart} label="Loved" value={formatNumber(metrics.Database.NumberStoredLoved)} />
          <Item icon={Trash} label="Unranked" value={formatNumber(metrics.Database.NumberStoredUnranked)} />
          <Item icon={CalendarClock} label="Last map added" value={formatDate(metrics.Database.LastBeatmapAdded)} />
          <Link to="/status" className="mt-1 text-xs font-medium text-accent hover:underline">
            More server stats
          </Link>
        </div>
      ) : (
        <p className="text-[13px] text-fg-subtle">The server can't be reached right now. Searching and downloading won't work until it's back.</p>
      )}
    </Card>
  );
};
