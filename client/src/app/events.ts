import { BrowserWindow } from "electron";
import { DownloadInfo, LibraryStatus, Notice, UpdateInfo } from "../models/ipc";

let window: BrowserWindow | null = null;

export const setWindow = (value: BrowserWindow | null) => {
  window = value;
};

export const getWindow = () => window;

const send = (channel: string, payload: unknown) => {
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
};

export const emitDownloads = (downloads: DownloadInfo[]) => send("downloads:update", downloads);
export const emitLibrary = (status: LibraryStatus) => send("library:update", status);
export const emitNotice = (notice: Notice) => send("app:notice", notice);
export const emitUpdate = (update: UpdateInfo) => send("app:update", update);
export const emitError = (message: string) => emitNotice({ type: "error", message });
