import clsx from "clsx";
import { Download, Heart, House, LucideIcon, MessageCircle, Scroll, Search, Server, Settings } from "lucide-react";
import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useDownloads } from "../../context/DownloadProvider";
import { useLibrary } from "../../context/LibraryProvider";
import { useStatus } from "../../context/StatusProvider";
import { formatNumber, formatSpeed } from "../../util/format";
import { Progress } from "../ui/Progress";

interface Page {
  to: string;
  label: string;
  icon: LucideIcon;
}

const pages: Page[] = [
  { to: "/", label: "Home", icon: House },
  { to: "/search", label: "Search", icon: Search },
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/status", label: "Server", icon: Server },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/changelog", label: "What's new", icon: Scroll },
];

const links = [
  { url: "https://discord.gg/3nj6cKzynK", label: "Discord", icon: MessageCircle },
  { url: "https://www.buymeacoffee.com/nzbasic", label: "Support", icon: Heart },
];

const DownloadActivity = () => {
  const { totals } = useDownloads();
  if (!totals.total || !totals.remaining) return null;

  return (
    <NavLink
      to="/downloads"
      className="block animate-fade-in rounded-xl border border-line bg-surface p-3 transition-colors hover:border-fg-subtle/40"
    >
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium text-fg">{totals.running ? "Downloading" : "Paused"}</span>
        <span className="tabular-nums text-fg-subtle">
          {formatNumber(totals.done)}/{formatNumber(totals.total)}
        </span>
      </div>
      <Progress value={totals.total ? totals.done / totals.total : 0} active={totals.running > 0} />
      {totals.running > 0 && (
        <div className="mt-1.5 text-2xs tabular-nums text-fg-subtle">{formatSpeed(totals.speed)}</div>
      )}
    </NavLink>
  );
};

export const Menu = () => {
  const { library } = useLibrary();
  const { online, loading } = useStatus();
  const { totals } = useDownloads();
  const [version, setVersion] = useState("");

  useEffect(() => {
    window.electron.getVersion().then(setVersion);
  }, []);

  return (
    <aside className="flex w-[232px] shrink-0 flex-col px-3 pb-3 pt-2">
      <nav className="flex flex-col gap-0.5">
        {pages.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              clsx(
                "group flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors",
                isActive ? "bg-surface-raised text-fg shadow-sm ring-1 ring-line" : "text-fg-muted hover:bg-surface/70 hover:text-fg",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} strokeWidth={2.1} className={clsx(isActive ? "text-accent" : "text-fg-subtle group-hover:text-fg-muted")} />
                <span className="flex-1">{label}</span>
                {to === "/downloads" && totals.running > 0 && (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <DownloadActivity />

        {library?.valid && (
          <div className="rounded-xl px-3 text-xs">
            <div className="flex items-center gap-2 text-fg-muted">
              <span className="font-medium text-fg">{library.client === "lazer" ? "osu!lazer" : "osu!stable"}</span>
              {library.running && <span className="text-2xs text-success">running</span>}
            </div>
            <div className="mt-0.5 text-fg-subtle">{formatNumber(library.setCount)} beatmap sets</div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-line px-1 pt-3">
          <div className="flex items-center gap-1">
            {links.map(({ url, label, icon: Icon }) => (
              <button
                key={url}
                title={label}
                onClick={() => window.electron.openExternal(url)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-fg"
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-2xs text-fg-subtle" title={online ? "Server online" : "Server offline"}>
            <span
              className={clsx(
                "h-1.5 w-1.5 rounded-full",
                loading ? "bg-fg-subtle" : online ? "bg-success shadow-[0_0_6px] shadow-success" : "bg-danger",
              )}
            />
            v{version}
          </div>
        </div>
      </div>
    </aside>
  );
};
