import { app, dialog, ipcMain, IpcMainInvokeEvent, nativeTheme, shell } from "electron";
import { AppSettings, CreateDownloadOptions, QueryOrder } from "../models/ipc";
import {
  clearFinished,
  deleteDownload,
  listDownloads,
  pauseAll,
  pauseDownload,
  resumeAll,
  resumeDownload,
  retryFailed,
} from "./download/manager";
import { getWindow } from "./events";
import { discardPendingCollections, getLibraryStatus, processPending, refreshLibraryStatus } from "./library";
import { detectPaths, exists } from "./paths";
import { downloadMissingMaps, downloadSearch, findMissingMaps, getResultPage, search } from "./search";
import { getMetrics } from "./server";
import { getSettings, updateSettings } from "./store";
import { applyWindowTheme } from "./window";

type Handler = (...args: never[]) => unknown;

const handle = (channel: string, handler: Handler) => {
  ipcMain.handle(channel, (_event: IpcMainInvokeEvent, ...args: unknown[]) => (handler as (...a: unknown[]) => unknown)(...args));
};

const isWebUrl = (url: string) => {
  try {
    return ["https:", "http:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
};

export const registerIpc = () => {
  // app
  handle("app:version", () => app.getVersion());
  handle("app:platform", () => process.platform);
  handle("app:open-external", (url: string) => {
    if (isWebUrl(url)) return shell.openExternal(url);
  });
  handle("app:open-path", async (target: string) => {
    if (await exists(target)) await shell.openPath(target);
  });
  handle("app:browse-folder", async (title?: string, defaultPath?: string) => {
    const window = getWindow();
    const options: Electron.OpenDialogOptions = { title, defaultPath: defaultPath || undefined, properties: ["openDirectory"] };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  handle("app:browse-file", async (title?: string, defaultPath?: string) => {
    const window = getWindow();
    const options: Electron.OpenDialogOptions = { title, defaultPath: defaultPath || undefined, properties: ["openFile"] };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  // settings
  handle("settings:get", () => getSettings());
  handle("settings:detect", () => detectPaths());
  handle("settings:update", async (patch: Partial<AppSettings>) => {
    const settings = await updateSettings(patch);
    if (patch.theme) {
      nativeTheme.themeSource = settings.theme;
      applyWindowTheme(settings.theme);
    }
    refreshLibraryStatus().catch(() => undefined);
    return settings;
  });

  // library
  handle("library:status", () => getLibraryStatus());
  handle("library:process-pending", () => {
    // Can take a while (e.g. waiting for lazer to start), progress is reported through notices
    processPending();
  });
  handle("library:discard-collections", () => discardPendingCollections());
  handle("library:missing", () => findMissingMaps());

  // search
  handle("search:query", (node: unknown, name: string, limit?: number, order?: QueryOrder) =>
    search(node, name, limit, order),
  );
  handle("search:page", (id: string, page: number, pageSize: number) => getResultPage(id, page, pageSize));

  // downloads
  handle("downloads:list", () => listDownloads());
  handle("downloads:from-search", (id: string, options: CreateDownloadOptions) => downloadSearch(id, options));
  handle("downloads:missing", () => downloadMissingMaps());
  handle("downloads:pause", (id: string) => pauseDownload(id));
  handle("downloads:resume", (id: string) => resumeDownload(id));
  handle("downloads:retry", (id: string) => retryFailed(id));
  handle("downloads:delete", (id: string) => deleteDownload(id));
  handle("downloads:pause-all", () => pauseAll());
  handle("downloads:resume-all", () => resumeAll());
  handle("downloads:clear-finished", () => clearFinished());

  // server
  handle("server:metrics", () => getMetrics());
};
