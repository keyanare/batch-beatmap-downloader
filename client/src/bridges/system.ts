import { Notice } from "../models/ipc";
import { invoke, subscribe } from "./invoke";

export const systemBridge = {
  getVersion: () => invoke<string>("app:version"),
  getPlatform: () => invoke<NodeJS.Platform>("app:platform"),
  openExternal: (url: string) => invoke<void>("app:open-external", url),
  openPath: (path: string) => invoke<void>("app:open-path", path),
  browseFolder: (title?: string, defaultPath?: string) => invoke<string | null>("app:browse-folder", title, defaultPath),
  browseFile: (title?: string, defaultPath?: string) => invoke<string | null>("app:browse-file", title, defaultPath),
  onNotice: (callback: (notice: Notice) => void) => subscribe("app:notice", callback),
};
