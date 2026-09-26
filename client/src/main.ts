import "./app/dev-paths";
import { app, nativeTheme } from "electron";
import log from "electron-log/main";
import { updateElectronApp } from "update-electron-app";
import { removeLegacyDownloader } from "./app/cleanup";
import { loadDownloads, shutdownDownloads } from "./app/download/manager";
import { getWindow, setWindow } from "./app/events";
import { registerIpc } from "./app/ipc";
import { refreshLibraryStatus, startLibraryWatcher } from "./app/library";
import { detectPaths } from "./app/paths";
import { applyDetectedDefaults, getSettings } from "./app/store";
import { createWindow } from "./app/window";

log.initialize();
log.errorHandler.startCatching();

// Squirrel runs the app with special arguments while installing/uninstalling on Windows
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require("electron-squirrel-startup")) app.quit();

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = getWindow();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  if (app.isPackaged) updateElectronApp({ logger: log });

  app.whenReady().then(async () => {
    registerIpc();

    await applyDetectedDefaults(detectPaths).catch((error) => log.error("Detecting osu! failed", error));
    const settings = await getSettings();
    nativeTheme.themeSource = settings.theme;

    const window = createWindow(settings.theme);
    setWindow(window);
    window.on("closed", () => setWindow(null));

    await loadDownloads();
    startLibraryWatcher();
    removeLegacyDownloader();
    refreshLibraryStatus().catch((error) => log.error("Loading library failed", error));
  });

  let quitting = false;
  app.on("before-quit", (event) => {
    if (quitting) return;
    // Stop downloads cleanly and save their progress before exiting
    event.preventDefault();
    quitting = true;
    shutdownDownloads()
      .catch((error) => log.error("Saving downloads on exit failed", error))
      .finally(() => app.quit());
  });

  app.on("window-all-closed", () => app.quit());
}
