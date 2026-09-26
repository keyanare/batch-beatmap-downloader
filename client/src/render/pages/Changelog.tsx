import React from "react";
import { changeLog } from "../assets/changelog";
import { Badge } from "../components/ui/Badge";
import { PageHeader } from "../components/ui/Card";
import { formatDate } from "../util/format";

export const Changelog = () => (
  <div>
    <PageHeader title="What's new" description="Changes in each version of Batch Beatmap Downloader" />
    <div className="relative flex flex-col gap-8 pl-6">
      <div className="absolute bottom-2 left-[5px] top-2 w-px bg-line" />
      {changeLog.map((version, index) => (
        <section key={version.version} className="relative animate-fade-in">
          <div
            className={
              index === 0
                ? "absolute -left-6 top-1.5 h-[11px] w-[11px] rounded-full bg-accent ring-4 ring-accent/20"
                : "absolute -left-6 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-line bg-panel"
            }
          />
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight">v{version.version}</h2>
            {index === 0 && <Badge tone="accent">Latest</Badge>}
            <span className="text-xs text-fg-subtle">{formatDate(version.date)}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {version.changes.map((group) => (
              <div key={group.title} className="rounded-xl border border-line bg-surface p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">{group.title}</h3>
                <ul className="flex flex-col gap-1.5">
                  {group.changes.map((change) => (
                    <li key={change} className="flex gap-2 text-[13px] leading-5 text-fg-muted">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fg-subtle" />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  </div>
);
