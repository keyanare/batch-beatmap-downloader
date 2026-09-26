// Types shared between the main process, the preload bridge and the renderer.

export type GameClient = "stable" | "lazer";
export type Theme = "dark" | "light";

export interface AppSettings {
  client: GameClient;
  theme: Theme;
  maxConcurrentDownloads: number;

  // osu!stable
  path: string;
  altPathEnabled: boolean;
  altPath: string;
  temp: boolean;
  tempPath: string;
  autoTemp: boolean;

  // osu!lazer
  lazerPath: string;
  lazerExe: string;
  lazerAutoImport: boolean;
}

export interface DetectedPaths {
  stable: string | null;
  lazer: string | null;
  lazerExe: string | null;
}

export interface LibraryStatus {
  client: GameClient;
  valid: boolean;
  /** Why the library can't be used, when `valid` is false. */
  problem?: string;
  /** Something that works worse than it should, but doesn't stop the app from working. */
  warning?: string;
  /** The configured game folder (stable install folder or lazer data folder). */
  path: string;
  /** Number of beatmap sets already in the library. */
  setCount: number;
  /** Where new downloads are written to. */
  downloadDir: string;
  /** Whether the game is currently running. */
  running: boolean;
  /** stable: .osz files in the temp folder. lazer: .osz files waiting to be imported. */
  pending: number;
  /** Collections waiting for the game to close before they can be written. */
  pendingCollections: string[];
  /** lazer: whether osu!.exe was found, so the app can start the game to import maps. */
  canLaunch: boolean;
}

export interface QueryOrder {
  by: string;
  direction: string;
}

export interface SearchSummary {
  /** Server side id of the query, used for metrics. */
  id: string;
  beatmaps: number;
  sets: number;
  /** Sets that are not in the library yet. */
  newSets: number;
  totalSize: number;
  newSize: number;
}

export interface MissingMaps {
  collections: number;
  beatmaps: number;
  /** Beatmaps in collections that the server doesn't know about. */
  unavailable: number;
  ids: number[];
  totalSize: number;
}

export type DownloadState = "running" | "paused" | "waiting" | "finished";

export interface DownloadInfo {
  id: string;
  name: string;
  createdAt: number;
  state: DownloadState;
  /** Set when the download was paused because of a problem rather than by the user. */
  error?: string;
  force: boolean;
  collectionName?: string;

  total: number;
  completed: number;
  failed: number;
  skipped: number;

  totalBytes: number;
  downloadedBytes: number;
  /** Bytes per second over the last few seconds. */
  speed: number;
}

export interface CreateDownloadOptions {
  force: boolean;
  collectionName?: string;
}

export interface Notice {
  type: "error" | "info" | "success";
  message: string;
}
