import { app, autoUpdater, net } from "electron";
import log from "electron-log/main";
import { updateElectronApp } from "update-electron-app";
import { repository } from "../../package.json";
import { UpdateInfo } from "../models/ipc";
import { shutdownDownloads } from "./download/manager";
import { emitNotice, emitUpdate } from "./events";
import { setQuitting } from "./lifecycle";

// Windows installs update themselves through Squirrel: the new version downloads in the background and is
// used from the next start, or right away after "Restart to update". The macOS and Linux builds aren't signed,
// so they can't update themselves and only get told when there's a new version.

const repo = /github\.com\/([^/]+\/[^/.]+)/.exec(repository.url)?.[1];

let update: UpdateInfo | null = null;

const setUpdate = (next: UpdateInfo) => {
  update = next;
  emitUpdate(next);
};

export const getUpdate = () => update;

const parse = (version: string) => version.replace(/^v/, "").split(/[.-]/).map((part) => parseInt(part) || 0);

const isNewer = (candidate: string, current: string) => {
  const [a, b] = [parse(candidate), parse(current)];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
};

const latestRelease = async () => {
  if (!repo) return null;
  try {
    const response = await net.fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const release = (await response.json()) as { tag_name: string; html_url: string };
    return { version: release.tag_name.replace(/^v/, ""), url: release.html_url };
  } catch (error) {
    log.warn("Checking for updates failed", error);
    return null;
  }
};

const releasesPage = () => `https://github.com/${repo}/releases/latest`;

const checkGitHub = async () => {
  const release = await latestRelease();
  if (!release || !isNewer(release.version, app.getVersion())) return;
  setUpdate({ ...release, state: "available" });
  emitNotice({ type: "info", message: `Batch Beatmap Downloader ${release.version} is out, get it in Settings` });
};

const watchSquirrel = () => {
  // The library checks again every 10 minutes and Squirrel reports the same update each time,
  // so only speak up when something changed.
  autoUpdater.on("update-available", () => {
    if (update) return;
    // Squirrel doesn't say which version it found, GitHub does
    setUpdate({ version: "", url: releasesPage(), state: "downloading" });
    latestRelease().then((release) => {
      if (release && update?.state === "downloading") setUpdate({ ...release, state: "downloading" });
      const version = release ? ` ${release.version}` : "";
      emitNotice({ type: "info", message: `Downloading update${version} in the background` });
    });
  });

  autoUpdater.on("update-downloaded", (_event, _notes, releaseName: string | undefined) => {
    const version = /\d+\.\d+\.\d+/.exec(releaseName ?? "")?.[0] ?? update?.version ?? "";
    if (update?.state === "ready" && update.version === version) return;
    setUpdate({ version, url: update?.url ?? releasesPage(), state: "ready" });
    emitNotice({
      type: "success",
      message: `Update${version ? ` ${version}` : ""} is ready. Restart from the sidebar or Settings, or it installs next time`,
    });
  });

  autoUpdater.on("error", (error) => log.warn("Auto update failed", error));
};

export const setupUpdates = () => {
  if (process.platform === "win32") {
    watchSquirrel();
    // The app shows its own notifications instead of the library's dialog
    if (app.isPackaged) updateElectronApp({ logger: log, notifyUser: false });
  } else if (app.isPackaged) {
    setTimeout(checkGitHub, 5000);
  }
};

/** Restarts into the downloaded update, after saving the downloads so they carry on afterwards. */
export const installUpdate = async () => {
  if (update?.state !== "ready") return;
  setQuitting();
  await shutdownDownloads().catch((error) => log.error("Saving downloads before updating failed", error));
  autoUpdater.quitAndInstall();
};
