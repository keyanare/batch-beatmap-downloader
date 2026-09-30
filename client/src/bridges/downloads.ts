import { CreateDownloadOptions, DownloadInfo } from "../models/ipc";
import { invoke, subscribe } from "./invoke";

export const downloadsBridge = {
  getDownloads: () => invoke<DownloadInfo[]>("downloads:list"),
  downloadSearch: (searchId: string, options: CreateDownloadOptions) =>
    invoke<DownloadInfo | null>("downloads:from-search", searchId, options),
  downloadMissing: () => invoke<DownloadInfo | null>("downloads:missing"),
  downloadMapUpdates: () => invoke<DownloadInfo | null>("downloads:map-updates"),
  pauseDownload: (id: string) => invoke<void>("downloads:pause", id),
  resumeDownload: (id: string) => invoke<void>("downloads:resume", id),
  retryFailed: (id: string) => invoke<void>("downloads:retry", id),
  deleteDownload: (id: string) => invoke<void>("downloads:delete", id),
  pauseAll: () => invoke<void>("downloads:pause-all"),
  resumeAll: () => invoke<void>("downloads:resume-all"),
  clearFinished: () => invoke<void>("downloads:clear-finished"),
  onDownloads: (callback: (downloads: DownloadInfo[]) => void) => subscribe("downloads:update", callback),
};
