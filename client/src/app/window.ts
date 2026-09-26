import { app, BrowserWindow, shell } from "electron";
import { Theme } from "../models/ipc";
import { getWindow } from "./events";

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

export const TITLE_BAR_HEIGHT = 40;

// Keep in sync with the surface colours in tailwind.config.js
const colors: Record<Theme, { background: string; symbols: string }> = {
  dark: { background: "#101014", symbols: "#e4e4e7" },
  light: { background: "#f4f4f6", symbols: "#27272a" },
};

export const applyWindowTheme = (theme: Theme) => {
  const window = getWindow();
  if (!window || process.platform === "darwin") return;
  window.setTitleBarOverlay({
    color: colors[theme].background,
    symbolColor: colors[theme].symbols,
    height: TITLE_BAR_HEIGHT,
  });
};

export const createWindow = (theme: Theme) => {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "Batch Beatmap Downloader",
    backgroundColor: colors[theme].background,
    titleBarStyle: "hidden",
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 16, y: 13 } }
      : {
          titleBarOverlay: {
            color: colors[theme].background,
            symbolColor: colors[theme].symbols,
            height: TITLE_BAR_HEIGHT,
          },
        }),
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  window.setMenu(null);
  window.once("ready-to-show", () => window.show());

  // Links open in the browser, the app window never navigates anywhere else
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });

  if (!app.isPackaged) {
    window.webContents.on("before-input-event", (_event, input) => {
      if (input.type === "keyDown" && input.key === "F12") window.webContents.toggleDevTools();
    });
  }

  window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  return window;
};
