import "./app/dev-paths";
import { app, Menu, nativeTheme } from "electron";
import log from "electron-log/main";
import { removeLegacyDownloader } from "./app/cleanup";
import { loadDownloads, shutdownDownloads } from "./app/download/manager";
import { getWindow, setWindow } from "./app/events";
import { isQuitting, setQuitting } from "./app/lifecycle";
import { registerIpc } from "./app/ipc";
import { refreshLibraryStatus, startLibraryWatcher } from "./app/library";
import { detectPaths } from "./app/paths";
import { applyDetectedDefaults, getSettings } from "./app/store";
import { setupUpdates } from "./app/updates";
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

  app.whenReady().then(async () => {
    registerIpc();

    // macOS needs an application menu for things like copy/paste and Cmd+Q to work
    Menu.setApplicationMenu(
      process.platform === "darwin"
        ? Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }])
        : null,
    );

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
    setupUpdates();
  });

  app.on("before-quit", (event) => {
    if (isQuitting()) return;
    // Stop downloads cleanly and save their progress before exiting
    event.preventDefault();
    setQuitting();
    shutdownDownloads()
      .catch((error) => log.error("Saving downloads on exit failed", error))
      .finally(() => app.quit());
  });

  app.on("window-all-closed", () => app.quit());
}
