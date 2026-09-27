import { app, net } from "electron";
import log from "electron-log/main";
import { repository } from "../../package.json";
import { UpdateInfo } from "../models/ipc";
import { emitNotice } from "./events";

// Windows installs update themselves through Squirrel. The macOS and Linux builds aren't signed, so they
// can't, and only get told when there's a new version.

const repo = /github\.com\/([^/]+\/[^/.]+)/.exec(repository.url)?.[1];

let available: UpdateInfo | null = null;

const parse = (version: string) => version.replace(/^v/, "").split(/[.-]/).map((part) => parseInt(part) || 0);

const isNewer = (candidate: string, current: string) => {
  const [a, b] = [parse(candidate), parse(current)];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
};

export const checkForUpdates = async () => {
  if (!repo) return;
  try {
    const response = await net.fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!response.ok) return;
    const release = (await response.json()) as { tag_name: string; html_url: string };
    if (!isNewer(release.tag_name, app.getVersion())) return;

    available = { version: release.tag_name.replace(/^v/, ""), url: release.html_url };
    emitNotice({ type: "info", message: `Batch Beatmap Downloader ${available.version} is out, get it in Settings` });
  } catch (error) {
    log.warn("Checking for updates failed", error);
  }
};

export const getAvailableUpdate = () => available;
