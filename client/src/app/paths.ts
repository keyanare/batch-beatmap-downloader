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

export const detectStablePath = async () => {
  const candidates: (string | null)[] = [];
  if (process.platform === "win32") {
    candidates.push(await stableFromRegistry());
    if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, "osu!"));
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

export const detectLazerPath = async () => {
  const defaultDir = defaultLazerDataDir();
  const custom = await customLazerDataDir(defaultDir);
  for (const candidate of [custom, defaultDir]) {
    if (candidate && (await isLazerFolder(candidate))) return candidate;
  }
  return null;
};

export const detectLazerExe = async () => {
  const candidates: string[] = [];
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, "osulazer", "current", "osu!.exe"));
  } else if (process.platform === "darwin") {
    candidates.push("/Applications/osu!.app/Contents/MacOS/osu!");
    candidates.push(path.join(os.homedir(), "Applications", "osu!.app", "Contents", "MacOS", "osu!"));
  }

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  return null;
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
