import { AppSettings, DetectedPaths, LibraryStatus, MapUpdateCheck, MissingMaps } from "../models/ipc";
import { invoke, subscribe } from "./invoke";

export const settingsBridge = {
  getSettings: () => invoke<AppSettings>("settings:get"),
  updateSettings: (patch: Partial<AppSettings>) => invoke<AppSettings>("settings:update", patch),
  detectPaths: () => invoke<DetectedPaths>("settings:detect"),

  getLibrary: () => invoke<LibraryStatus>("library:status"),
  processPending: () => invoke<void>("library:process-pending"),
  discardPendingCollections: () => invoke<void>("library:discard-collections"),
  findMissingMaps: () => invoke<MissingMaps>("library:missing"),
  checkMapUpdates: () => invoke<MapUpdateCheck>("library:check-updates"),
  onLibrary: (callback: (status: LibraryStatus) => void) => subscribe("library:update", callback),
};
