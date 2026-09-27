import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { DetectedPaths } from "../models/ipc";

export const exists = async (target: string) => {
  if (!target) return false;
  try {
    await fs.promises.access(target);
    return true;
  } catch {
    return false;
  }
};

export const isDirectory = async (target: string) => {
  if (!target) return false;
  try {
    return (await fs.promises.stat(target)).isDirectory();
  } catch {
    return false;
  }
};

const run = (file: string, args: string[]) =>
  new Promise<string>((resolve) => {
    execFile(file, args, { windowsHide: true, timeout: 5000 }, (error, stdout) => resolve(error ? "" : stdout));
  });

// osu!stable

export const isStableFolder = async (folder: string) =>
  (await exists(path.join(folder, "osu!.exe"))) ||
  (await exists(path.join(folder, "osu!.db"))) ||
  (await isDirectory(path.join(folder, "Songs")));

const stableFromRegistry = async () => {
  if (process.platform !== "win32") return null;
  // Set by the stable installer: "C:\...\osu!.exe" "%1"
  const output = await run("reg", ["query", String.raw`HKCR\osustable.File.osz\Shell\Open\Command`, "/ve"]);
  const match = /"([^"]*osu!\.exe)"/i.exec(output);
  return match ? path.dirname(match[1]) : null;
};

const listDir = async (dir: string) => {
  try {
    return await fs.promises.readdir(dir);
  } catch {
    return [];
  }
};

/** App bundles in the Applications folders whose name matches. */
const macApps = async (pattern: RegExp) => {
  const folders = ["/Applications", path.join(os.homedir(), "Applications")];
  const apps: string[] = [];
  for (const folder of folders) {
    for (const name of await listDir(folder)) {
      if (name.endsWith(".app") && pattern.test(name)) apps.push(path.join(folder, name));
    }
  }
  return apps;
};

// Where osu!stable usually ends up when it runs through wine
const wineStableCandidates = async () => {
  const home = os.homedir();
  const user = os.userInfo().username;
  const inPrefix = (prefix: string) => [
    path.join(prefix, "drive_c", "users", user, "AppData", "Local", "osu!"),
    path.join(prefix, "drive_c", "osu!"),
    path.join(prefix, "drive_c", "Program Files", "osu!"),
  ];

  const candidates = [
    // osu-winello
    path.join(home, ".local", "share", "osu-wine", "osu!"),
    path.join(home, ".local", "share", "osu-wine", "OSU"),
    ...inPrefix(path.join(home, ".wine")),
    ...inPrefix(path.join(home, ".local", "share", "wineprefixes", "osu")),
    // Lutris
    ...inPrefix(path.join(home, "Games", "osu")),
    ...inPrefix(path.join(home, "Games", "osu-stable")),
  ];

  if (process.platform === "darwin") {
    // Wine wrapped osu!stable apps
    for (const app of await macApps(/osu/i)) {
      candidates.push(...inPrefix(path.join(app, "Contents", "Resources")));
      candidates.push(...inPrefix(path.join(app, "Contents", "SharedSupport", "prefix")));
    }
  }
  return candidates;
};

export const detectStablePath = async () => {
  const candidates: (string | null)[] = [];
  if (process.platform === "win32") {
    candidates.push(await stableFromRegistry());
    if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, "osu!"));
  } else {
    candidates.push(...(await wineStableCandidates()));
  }

  for (const candidate of candidates) {
    if (candidate && (await isStableFolder(candidate))) return candidate;
  }
  return null;
};

// osu!lazer

const defaultLazerDataDir = () => {
  switch (process.platform) {
    case "win32":
      return path.join(process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"), "osu");
    case "darwin":
      return path.join(os.homedir(), "Library", "Application Support", "osu");
    default:
      return path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"), "osu");
  }
};

export const LAZER_DATABASE = "client.realm";

export const isLazerFolder = (folder: string) => exists(path.join(folder, LAZER_DATABASE));

/** Lazer keeps a storage.ini in its default folder when the user moved their data somewhere else. */
const customLazerDataDir = async (defaultDir: string) => {
  try {
    const ini = await fs.promises.readFile(path.join(defaultDir, "storage.ini"), "utf8");
    const match = /^\s*FullPath\s*=\s*(.+?)\s*$/m.exec(ini);
    return match ? match[1] : null;
  } catch {
    return null;
  }
};

// The Flatpak version keeps its data inside its own sandbox folder
const FLATPAK_ID = "sh.ppy.osu";
const flatpakLazerDataDir = () => path.join(os.homedir(), ".var", "app", FLATPAK_ID, "data", "osu");

export const detectLazerPath = async () => {
  const defaults = [defaultLazerDataDir()];
  if (process.platform === "linux") defaults.push(flatpakLazerDataDir());

  for (const defaultDir of defaults) {
    const custom = await customLazerDataDir(defaultDir);
    for (const candidate of [custom, defaultDir]) {
      if (candidate && (await isLazerFolder(candidate))) return candidate;
    }
  }
  return null;
};

const which = async (command: string) => {
  const output = await run("which", [command]);
  return output.trim().split(/\r?\n/)[0] || null;
};

const linuxLazerCandidates = async () => {
  const home = os.homedir();
  const candidates: (string | null)[] = [
    // AUR and other packages provide a launcher
    await which("osu-lazer"),
    await which("osu!"),
  ];

  // The official AppImage, wherever people usually keep AppImages
  for (const folder of [
    path.join(home, "Applications"),
    path.join(home, ".local", "bin"),
    path.join(home, "Downloads"),
    path.join(home, "Desktop"),
    "/opt/osu-lazer",
    "/opt/osu",
  ]) {
    for (const name of await listDir(folder)) {
      if (/^osu.*\.appimage$/i.test(name)) candidates.push(path.join(folder, name));
    }
  }

  candidates.push(
    path.join(home, ".local", "share", "flatpak", "exports", "bin", FLATPAK_ID),
    path.join("/var", "lib", "flatpak", "exports", "bin", FLATPAK_ID),
  );
  return candidates;
};

const macLazerCandidates = async () => {
  const candidates: string[] = [];
  for (const app of await macApps(/^osu/i)) {
    // Skip wine wrapped osu!stable apps
    if (await isDirectory(path.join(app, "Contents", "Resources", "drive_c"))) continue;
    if (await isDirectory(path.join(app, "Contents", "SharedSupport", "prefix"))) continue;
    candidates.push(await resolveExecutable(app));
  }
  return candidates;
};

export const detectLazerExe = async () => {
  let candidates: (string | null)[] = [];
  if (process.platform === "win32") {
    if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, "osulazer", "current", "osu!.exe"));
  } else if (process.platform === "darwin") {
    candidates = await macLazerCandidates();
  } else {
    candidates = await linuxLazerCandidates();
  }

  for (const candidate of candidates) {
    if (candidate && (await exists(candidate))) return candidate;
  }
  return null;
};

/**
 * Turns a macOS .app bundle into the executable inside it, so either can be chosen in settings.
 */
export const resolveExecutable = async (target: string) => {
  if (process.platform !== "darwin" || !target.endsWith(".app")) return target;
  let name = path.basename(target, ".app");
  try {
    const plist = await fs.promises.readFile(path.join(target, "Contents", "Info.plist"), "utf8");
    const match = /<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/.exec(plist);
    if (match) name = match[1];
  } catch {
    // Binary plist or missing, fall back to the bundle name
  }
  return path.join(target, "Contents", "MacOS", name);
};

export const detectPaths = async (): Promise<DetectedPaths> => {
  const [stable, lazer, lazerExe] = await Promise.all([detectStablePath(), detectLazerPath(), detectLazerExe()]);
  return { stable, lazer, lazerExe };
};

/**
 * Moves a file, falling back to copy + delete when source and target are on different drives.
 */
export const moveFile = async (from: string, to: string) => {
  try {
    await fs.promises.rename(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    await fs.promises.copyFile(from, to);
    await fs.promises.unlink(from);
  }
};

export const listOszFiles = async (folder: string) => {
  try {
    const files = await fs.promises.readdir(folder);
    return files.filter((file) => file.toLowerCase().endsWith(".osz")).map((file) => path.join(folder, file));
  } catch {
    return [];
  }
};

export const setIdFromName = (name: string) => {
  const match = /^(\d+)/.exec(path.basename(name));
  return match ? parseInt(match[1]) : null;
};
