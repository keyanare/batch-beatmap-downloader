import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { DownloadInfo } from "../../models/ipc";

export interface DownloadTotals {
  total: number;
  done: number;
  remaining: number;
  speed: number;
  running: number;
  bytesLeft: number;
}

interface DownloadsContextValue {
  downloads: DownloadInfo[];
  totals: DownloadTotals;
}

const DownloadsContext = createContext<DownloadsContextValue | null>(null);

export const remainingOf = (download: DownloadInfo) =>
  Math.max(0, download.total - download.completed - download.failed - download.skipped);

const DownloadsProvider = ({ children }: PropsWithChildren) => {
  const [downloads, setDownloads] = useState<DownloadInfo[]>([]);

  useEffect(() => {
    window.electron.getDownloads().then(setDownloads);
    return window.electron.onDownloads(setDownloads);
  }, []);

  const totals = useMemo(() => {
    const result: DownloadTotals = { total: 0, done: 0, remaining: 0, speed: 0, running: 0, bytesLeft: 0 };
    for (const download of downloads) {
      if (download.state === "finished") continue;
      const remaining = remainingOf(download);
      result.total += download.total;
      result.remaining += remaining;
      result.done += download.total - remaining;
      result.speed += download.speed;
      result.bytesLeft += Math.max(0, download.totalBytes - download.downloadedBytes);
      if (download.state === "running") result.running++;
    }
    return result;
  }, [downloads]);

  return <DownloadsContext.Provider value={{ downloads, totals }}>{children}</DownloadsContext.Provider>;
};

export const useDownloads = () => {
  const context = useContext(DownloadsContext);
  if (!context) throw new Error("useDownloads must be used inside DownloadsProvider");
  return context;
};

export default DownloadsProvider;
