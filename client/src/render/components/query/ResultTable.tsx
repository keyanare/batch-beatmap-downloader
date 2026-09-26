import clsx from "clsx";
import { Check, ChevronLeft, ChevronRight, Music } from "lucide-react";
import React, { useEffect, useState } from "react";
import { BeatmapDetails } from "../../../models/api";
import { SearchSummary } from "../../../models/ipc";
import { formatLength, formatNumber } from "../../util/format";
import { Badge, Tone } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Progress";

const PAGE_SIZE = 25;

// Roughly osu!'s difficulty colour spectrum
const starColor = (stars: number) => {
  if (stars < 2) return "#4fc0ff";
  if (stars < 2.7) return "#4fffd5";
  if (stars < 4) return "#7cff4f";
  if (stars < 5.3) return "#f6f05c";
  if (stars < 6.5) return "#ff8068";
  if (stars < 8) return "#ff4e6f";
  return "#c645b8";
};

// The server isn't consistent about how it names modes
const modeName = (mode: string) => {
  const lower = mode.toLowerCase();
  if (lower.includes("mania")) return "mania";
  if (lower.includes("taiko")) return "taiko";
  if (lower.includes("catch") || lower.includes("fruits")) return "catch";
  return "osu!";
};

const statusTones: Record<string, Tone> = {
  ranked: "success",
  approved: "success",
  loved: "accent",
  qualified: "info",
  pending: "warning",
  WIP: "warning",
  graveyard: "neutral",
};

const Cover = ({ setId }: { setId: number }) => {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-accent/30 to-[#b86bff]/30">
      {failed ? (
        <Music size={14} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/70" />
      ) : (
        <img
          src={`https://assets.ppy.sh/beatmaps/${setId}/covers/list.jpg`}
          loading="lazy"
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

const Row = ({ beatmap, owned }: { beatmap: BeatmapDetails; owned: boolean }) => (
  <tr className="group border-t border-line transition-colors hover:bg-surface-sunken/60">
    <td className="py-2 pl-5 pr-3">
      <div className="flex items-center gap-3">
        <Cover setId={beatmap.SetId} />
        <div className="min-w-0">
          <div className="max-w-[280px] truncate text-[13px] font-medium text-fg" title={beatmap.Title}>
            {beatmap.Title}
          </div>
          <div className="max-w-[280px] truncate text-xs text-fg-subtle" title={beatmap.Artist}>
            {beatmap.Artist}
          </div>
        </div>
      </div>
    </td>
    <td className="px-3 py-2">
      <div className="max-w-[180px] truncate text-[13px] text-fg-muted" title={beatmap.Version}>
        {beatmap.Version}
      </div>
      <div className="text-xs text-fg-subtle">
        {modeName(beatmap.Mode)} · by {beatmap.Creator}
      </div>
    </td>
    <td className="px-3 py-2">
      <span
        className="inline-flex h-5 items-center rounded-full px-2 text-2xs font-bold tabular-nums text-black/80"
        style={{ backgroundColor: starColor(beatmap.Stars) }}
      >
        ★ {beatmap.Stars.toFixed(2)}
      </span>
    </td>
    <td className="px-3 py-2 text-xs tabular-nums text-fg-muted">
      {formatLength(beatmap.HitLength)}
      <span className="text-fg-subtle"> · {Math.round(beatmap.Bpm)} bpm</span>
    </td>
    <td className="py-2 pl-3 pr-5">
      <div className="flex items-center justify-end gap-1.5">
        {owned && (
          <Badge tone="info" title="Already in your library">
            <Check size={11} strokeWidth={3} /> Owned
          </Badge>
        )}
        <Badge tone={statusTones[beatmap.Approved] ?? "neutral"} className="capitalize">
          {beatmap.Approved}
        </Badge>
      </div>
    </td>
  </tr>
);

export const ResultTable = ({ summary }: { summary: SearchSummary }) => {
  const [page, setPage] = useState(1);
  const [beatmaps, setBeatmaps] = useState<BeatmapDetails[]>([]);
  const [owned, setOwned] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pages = Math.max(1, Math.ceil(summary.beatmaps / PAGE_SIZE));

  // New results start at the first page
  useEffect(() => setPage(1), [summary.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    window.electron
      .getResultPage(summary.id, page, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setBeatmaps(result.beatmaps);
        setOwned(new Set(result.owned));
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [summary.id, page]);

  return (
    <div>
      {error ? (
        <div className="px-5 py-10 text-center text-[13px] text-danger">{error}</div>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-left text-2xs font-semibold uppercase tracking-wider text-fg-subtle">
              <th className="pb-2 pl-5 pr-3 font-semibold">Song</th>
              <th className="px-3 pb-2 font-semibold">Difficulty</th>
              <th className="px-3 pb-2 font-semibold">Stars</th>
              <th className="px-3 pb-2 font-semibold">Length</th>
              <th className="pb-2 pl-3 pr-5 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className={clsx(loading && beatmaps.length > 0 && "opacity-60 transition-opacity")}>
            {loading && !beatmaps.length
              ? Array.from({ length: 6 }, (_, index) => (
                  <tr key={index} className="border-t border-line">
                    <td colSpan={5} className="px-5 py-3">
                      <Skeleton className="h-8" />
                    </td>
                  </tr>
                ))
              : beatmaps.map((beatmap) => <Row key={beatmap.Id} beatmap={beatmap} owned={owned.has(beatmap.SetId)} />)}
          </tbody>
        </table>
      )}

      <div className="flex items-center justify-between border-t border-line px-5 py-3">
        <span className="text-xs text-fg-subtle">
          {formatNumber(Math.min((page - 1) * PAGE_SIZE + 1, summary.beatmaps))}–
          {formatNumber(Math.min(page * PAGE_SIZE, summary.beatmaps))} of {formatNumber(summary.beatmaps)}
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage(page - 1)} />
          <span className="min-w-[72px] text-center text-xs tabular-nums text-fg-muted">
            {page} / {formatNumber(pages)}
          </span>
          <Button size="sm" variant="secondary" icon={ChevronRight} disabled={page >= pages} onClick={() => setPage(page + 1)} />
        </div>
      </div>
    </div>
  );
};
