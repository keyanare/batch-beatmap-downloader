import log from "electron-log/main";
import { DownloadInfo } from "../../models/ipc";
import { emitDownloads, emitError, emitNotice } from "../events";
import { addCollection, refreshLibraryStatus } from "../library";
import { reportDownloadUpdate } from "../server";
import { getValue, setValue, unsetValue } from "../store";
import { DownloadController, DownloadHooks, PersistedDownload } from "./DownloadController";

const downloads = new Map<string, DownloadController>();

let emitTimer: NodeJS.Timeout | null = null;
let persistTimer: NodeJS.Timeout | null = null;
const dirty = new Set<string>();

const EMIT_INTERVAL = 250;
const PERSIST_DELAY = 5000;

export const listDownloads = (): DownloadInfo[] =>
  [...downloads.values()].map((download) => download.info()).sort((a, b) => b.createdAt - a.createdAt);

const emitNow = () => {
  if (emitTimer) clearTimeout(emitTimer);
  emitTimer = null;
  emitDownloads(listDownloads());
};

const scheduleEmit = () => {
  if (!emitTimer) emitTimer = setTimeout(emitNow, EMIT_INTERVAL);
};

const persist = async (download: DownloadController) => {
  await setValue(`downloads.${download.id}.status`, download.toPersisted());
};

const persistDirty = async () => {
  persistTimer = null;
  const ids = [...dirty];
  dirty.clear();
  for (const id of ids) {
    const download = downloads.get(id);
    if (download) await persist(download);
  }
};

const schedulePersist = (download: DownloadController) => {
  dirty.add(download.id);
  if (!persistTimer) {
    persistTimer = setTimeout(() => {
      persistDirty().catch((error) => log.error("Saving downloads failed", error));
    }, PERSIST_DELAY);
  }
};

let wasBusy = false;

const hooks: DownloadHooks = {
  onChange(download, important) {
    scheduleEmit();
    // Progress updates come in constantly, the rest only needs to happen when something actually changed
    if (!important) return;
    schedulePersist(download);

    // Library counts change once downloads settle
    const busy = [...downloads.values()].some((item) => item.shouldResumeOnStart);
    if (wasBusy && !busy) refreshLibraryStatus().catch(() => undefined);
    wasBusy = busy;
  },
};

// Downloads that were running when the app closed carry on when it starts again
const RESUME_KEY = "resumeDownloads";

export const loadDownloads = async () => {
  const stored = (await getValue<Record<string, { status?: PersistedDownload }>>("downloads")) ?? {};
  const resume = new Set((await getValue<string[]>(RESUME_KEY)) ?? []);
  await unsetValue(RESUME_KEY);

  for (const [id, entry] of Object.entries(stored)) {
    const status = entry?.status;
    if (!status || !Array.isArray(status.all) || !Array.isArray(status.completed)) {
      await unsetValue(`downloads.${id}`);
      continue;
    }

    const download = new DownloadController(
      {
        ...status,
        id,
        failed: status.failed ?? [],
        skipped: status.skipped ?? [],
        totalSize: status.totalSize ?? 0,
        totalProgress: status.totalProgress ?? 0,
        force: status.force ?? false,
      },
      hooks,
    );

    // Finished downloads are only kept around if some maps failed and can still be retried
    if (download.isFinished && download.info().failed === 0) {
      await unsetValue(`downloads.${id}`);
      continue;
    }
    downloads.set(id, download);
  }

  emitNow();
  for (const id of resume) downloads.get(id)?.resume();
};

export interface NewDownload {
  name: string;
  metricsId: string;
  ids: number[];
  sizes: Record<string, number>;
  force: boolean;
  collectionName?: string;
  hashes?: string[];
}

export const createDownload = async ({ name, metricsId, ids, sizes, force, collectionName, hashes }: NewDownload) => {
  // Sets that another unfinished download is already taking care of
  const taken = new Set<number>();
  for (const download of downloads.values()) {
    if (!download.isFinished) for (const id of download.pendingIds()) taken.add(id);
  }

  const unique = [...new Set(ids)].filter((id) => !taken.has(id));
  const totalSize = unique.reduce((sum, id) => sum + (sizes[id] ?? 0), 0);

  if (collectionName && hashes?.length) {
    addCollection(collectionName, hashes).catch((error: Error) => {
      log.error("Creating collection failed", error);
      emitError(`Couldn't create collection "${collectionName}": ${error.message}`);
    });
  }

  if (!unique.length) {
    emitNotice({ type: "info", message: "Those maps are already being downloaded" });
    return null;
  }

  const download = new DownloadController(
    {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      metricsId,
      collectionName,
      all: unique,
      completed: [],
      failed: [],
      skipped: [],
      totalSize,
      totalProgress: 0,
      force,
      sizes: Object.fromEntries(unique.map((id) => [id, sizes[id] ?? 0])),
    },
    hooks,
  );

  downloads.set(download.id, download);
  await persist(download);

  emitNow();
  download.resume();
  return download.info();
};

const get = (id: string) => {
  const download = downloads.get(id);
  if (!download) throw new Error("That download doesn't exist anymore");
  return download;
};

export const pauseDownload = (id: string) => get(id).pause();
export const resumeDownload = (id: string) => get(id).resume();
export const retryFailed = (id: string) => get(id).retryFailed();

export const pauseAll = () => downloads.forEach((download) => download.pause());
export const resumeAll = () => downloads.forEach((download) => download.resume());

export const deleteDownload = async (id: string) => {
  const download = get(id);
  downloads.delete(id);
  dirty.delete(id);
  await download.stop();
  if (!download.isFinished) reportDownloadUpdate(download.metricsId, "delete");
  await unsetValue(`downloads.${id}`);
  emitNow();
};

export const clearFinished = async () => {
  for (const download of [...downloads.values()]) {
    if (!download.isFinished) continue;
    downloads.delete(download.id);
    await unsetValue(`downloads.${download.id}`);
  }
  emitNow();
};

/** Stops all downloads and saves their progress. Used when the app closes. */
export const shutdownDownloads = async () => {
  if (persistTimer) clearTimeout(persistTimer);
  const running = [...downloads.values()].filter((download) => download.shouldResumeOnStart).map((download) => download.id);
  await setValue(RESUME_KEY, running);
  await Promise.all([...downloads.values()].map((download) => download.stop()));
  for (const download of downloads.values()) await persist(download);
};
