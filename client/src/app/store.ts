import settings from "electron-settings";
import { AppSettings, DetectedPaths, GameClient } from "../models/ipc";

type Raw = Record<string, unknown>;

const str = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);
const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

export const MAX_CONCURRENT_DOWNLOADS = 16;
export const clampConcurrency = (value: unknown) => {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 3;
  return Math.max(1, Math.min(MAX_CONCURRENT_DOWNLOADS, number));
};

const toSettings = (raw: Raw): AppSettings => ({
  // Existing installs only ever supported stable.
  client: raw.client === "lazer" || raw.client === "stable" ? raw.client : raw.path ? "stable" : "lazer",
  // Stored as darkMode for compatibility with older versions.
  theme: raw.darkMode === false ? "light" : "dark",
  maxConcurrentDownloads: clampConcurrency(raw.maxConcurrentDownloads),

  path: str(raw.path),
  altPathEnabled: bool(raw.altPathEnabled, false),
  altPath: str(raw.altPath),
  temp: bool(raw.temp, false),
  tempPath: str(raw.tempPath),
  autoTemp: bool(raw.autoTemp, true),

  lazerPath: str(raw.lazerPath),
  lazerExe: str(raw.lazerExe),
  lazerAutoImport: bool(raw.lazerAutoImport, true),
});

let cache: AppSettings | null = null;

export const getSettings = async (): Promise<AppSettings> => {
  if (!cache) cache = toSettings((await settings.get()) ?? {});
  return cache;
};

export const updateSettings = async (patch: Partial<AppSettings>): Promise<AppSettings> => {
  const current = await getSettings();
  const next: AppSettings = { ...current, ...patch };
  next.maxConcurrentDownloads = clampConcurrency(next.maxConcurrentDownloads);
  if (next.client !== "stable" && next.client !== "lazer") next.client = current.client;

  const { theme, ...rest } = next;
  for (const [key, value] of Object.entries(rest)) {
    await settings.set(key, value);
  }
  await settings.set("darkMode", theme !== "light");

  cache = next;
  return next;
};

export const getClient = async (): Promise<GameClient> => (await getSettings()).client;

/**
 * On the first start (of this version), fills in game folders we can find on this computer,
 * without touching anything the user already chose.
 */
export const applyDetectedDefaults = async (detect: () => Promise<DetectedPaths>) => {
  const raw: Raw = (await settings.get()) ?? {};
  if (raw.client !== undefined) return;

  const detected = await detect();
  const patch: Partial<AppSettings> = {
    // Older versions only supported stable, so an existing path means stable
    client: raw.path ? "stable" : detected.lazer ? "lazer" : detected.stable ? "stable" : "lazer",
  };
  if (!raw.path && detected.stable) patch.path = detected.stable;
  if (!raw.lazerPath && detected.lazer) patch.lazerPath = detected.lazer;
  if (!raw.lazerExe && detected.lazerExe) patch.lazerExe = detected.lazerExe;

  await updateSettings(patch);
};

// Values that aren't user facing settings.

export const getValue = async <T>(key: string): Promise<T | undefined> => (await settings.get(key)) as T | undefined;
export const setValue = async (key: string, value: unknown) => settings.set(key, value as Parameters<typeof settings.set>[1]);
export const unsetValue = async (key: string) => settings.unset(key);
