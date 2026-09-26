import humanizeDuration from "humanize-duration";

const units = ["B", "KB", "MB", "GB", "TB"];

export const formatBytes = (bytes: number, digits = 1) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : value >= 100 ? 0 : digits)} ${units[index]}`;
};

export const formatSpeed = (bytesPerSecond: number) => `${formatBytes(bytesPerSecond)}/s`;

const numberFormat = new Intl.NumberFormat("en-US");
export const formatNumber = (value: number) => numberFormat.format(value);

const shortDuration = humanizeDuration.humanizer({
  language: "short",
  languages: {
    short: { y: () => "y", mo: () => "mo", w: () => "w", d: () => "d", h: () => "h", m: () => "m", s: () => "s", ms: () => "ms" },
  },
  spacer: "",
  delimiter: " ",
  largest: 2,
  round: true,
});

export const formatDuration = (ms: number) => (ms < 1000 ? "<1s" : shortDuration(ms));

/** Seconds as m:ss */
export const formatLength = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
};

export const formatDate = (value: number | Date) =>
  new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const formatRelative = (value: number) => {
  const diff = Date.now() - value;
  if (diff < 60_000) return "just now";
  return `${shortDuration(diff)} ago`;
};

export const plural = (count: number, word: string, pluralWord = `${word}s`) =>
  `${formatNumber(count)} ${count === 1 ? word : pluralWord}`;
