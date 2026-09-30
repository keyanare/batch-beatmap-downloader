import log from "electron-log/main";
import { GameClient, LibraryStatus } from "../../models/ipc";
import { emitError, emitLibrary, emitNotice } from "../events";
import { exists } from "../paths";
import { getSettings, getValue, setValue } from "../store";
import { LazerLibrary } from "./lazer";
import { StableLibrary } from "./stable";
import { Library } from "./types";

let current: { key: string; library: Library } | null = null;

export const getLibrary = async (): Promise<Library> => {
  const settings = await getSettings();
  const key = JSON.stringify(settings);
  if (current?.key !== key) {
    const library = settings.client === "lazer" ? new LazerLibrary(settings) : new StableLibrary(settings);
    current = { key, library };
  }
  return current.library;
};

// Collections are written into the game's database, which is only safe while the game is closed.
// Until then they wait here.

interface PendingCollection {
  client: GameClient;
  root: string;
  name: string;
  hashes: string[];
}

const PENDING_KEY = "pendingCollections";

const getPendingCollections = async () => (await getValue<PendingCollection[]>(PENDING_KEY)) ?? [];

const setPendingCollections = (pending: PendingCollection[]) => setValue(PENDING_KEY, pending);

const gameName = (client: GameClient) => (client === "lazer" ? "osu!lazer" : "osu!");

/**
 * Adds beatmaps to a collection in the game. When the game is running this is postponed until it closes.
 */
export const addCollection = async (name: string, hashes: string[]) => {
  const library = await getLibrary();
  if (await library.isRunning()) {
    const pending = await getPendingCollections();
    pending.push({ client: library.client, root: library.root, name, hashes });
    await setPendingCollections(pending);
    emitNotice({
      type: "info",
      message: `Collection "${name}" will be created once you close ${gameName(library.client)}`,
    });
  } else {
    await library.writeCollection(name, hashes);
    emitNotice({ type: "success", message: `Collection "${name}" created` });
  }
  await refreshLibraryStatus();
};

let writingCollections = false;

const writePendingCollections = async (library: Library) => {
  if (writingCollections) return;
  const pending = await getPendingCollections();
  const mine = pending.filter((item) => item.client === library.client && item.root === library.root);
  if (!mine.length || (await library.isRunning())) return;

  writingCollections = true;
  try {
    const remaining = pending.filter((item) => !mine.includes(item));
    for (const item of mine) {
      try {
        await library.writeCollection(item.name, item.hashes);
        emitNotice({ type: "success", message: `Collection "${item.name}" created` });
      } catch (error) {
        log.error(`Writing collection ${item.name} failed`, error);
        emitError(`Couldn't create collection "${item.name}": ${(error as Error).message}`);
      }
    }
    await setPendingCollections(remaining);
    await refreshLibraryStatus();
  } finally {
    writingCollections = false;
  }
};

export const discardPendingCollections = async () => {
  const library = await getLibrary();
  const pending = await getPendingCollections();
  await setPendingCollections(pending.filter((item) => item.client !== library.client || item.root !== library.root));
  await refreshLibraryStatus();
};

export const getLibraryStatus = async (): Promise<LibraryStatus> => {
  const settings = await getSettings();
  const library = await getLibrary();
  const problem = await library.validate();
  const valid = problem === null;

  let setCount = 0;
  let downloadDir = "";
  let pending = 0;
  let importing = 0;
  let failedImports = 0;
  let loadProblem: string | undefined;

  if (valid) {
    try {
      setCount = (await library.ownedSetIds()).size;
      downloadDir = await library.downloadDir();
      pending = (await library.pendingFiles()).length;
      const progress = await library.importProgress?.();
      importing = progress?.importing ?? 0;
      failedImports = progress?.failed ?? 0;
    } catch (error) {
      loadProblem = (error as Error).message;
    }
  }

  const pendingCollections = (await getPendingCollections())
    .filter((item) => item.client === library.client && item.root === library.root)
    .map((item) => item.name);

  return {
    client: library.client,
    valid: valid && !loadProblem,
    problem: problem ?? loadProblem,
    warning: library.warning() ?? undefined,
    path: library.root,
    setCount,
    downloadDir,
    running: await library.isRunning(),
    pending,
    importing,
    failedImports,
    pendingCollections,
    canLaunch: settings.client === "lazer" && (await exists(settings.lazerExe)),
  };
};

let lastStatus: LibraryStatus | null = null;

export const refreshLibraryStatus = async () => {
  const status = await getLibraryStatus();
  lastStatus = status;
  emitLibrary(status);
  return status;
};

let processing = false;

/** Moves (stable) or imports (lazer) everything that's waiting in the download folder. */
export const processPending = async () => {
  if (processing) return;
  processing = true;
  try {
    const library = await getLibrary();
    const count = await library.processPending();
    if (library.client === "stable") {
      if (count) emitNotice({ type: "success", message: `Moved ${count} beatmap set(s) into your Songs folder` });
    } else if (count) {
      emitNotice({ type: "success", message: `Handed ${count} beatmap set(s) to osu!lazer` });
    } else if ((await library.pendingFiles()).length) {
      const { lazerAutoImport } = await getSettings();
      emitNotice({
        type: "info",
        message: lazerAutoImport
          ? "osu!lazer is still busy with the maps it has, the rest follow automatically"
          : "osu!lazer is still busy with the maps it has, import the rest once it's through them",
      });
    }
  } catch (error) {
    emitError((error as Error).message);
  } finally {
    processing = false;
    await refreshLibraryStatus().catch(() => undefined);
  }
};

const tick = async () => {
  const library = await getLibrary();
  if ((await library.validate()) !== null) return;

  await library.tick();
  await writePendingCollections(library);

  // Let the UI know when the game was opened/closed or imports progressed
  const running = await library.isRunning();
  const pending = (await library.pendingFiles()).length;
  const progress = (await library.importProgress?.()) ?? { importing: 0, failed: 0 };
  if (!lastStatus || lastStatus.client !== library.client || lastStatus.path !== library.root) return;

  if (running !== lastStatus.running || (pending === 0 && lastStatus.pending > 0)) {
    // Worth rescanning the library
    await refreshLibraryStatus();
  } else if (
    pending !== lastStatus.pending ||
    progress.importing !== lastStatus.importing ||
    progress.failed !== lastStatus.failedImports
  ) {
    // Cheap update while lazer works through an import, without rereading its database every time
    lastStatus = { ...lastStatus, pending, importing: progress.importing, failedImports: progress.failed };
    emitLibrary(lastStatus);
  }
};

export const startLibraryWatcher = () => {
  let busy = false;
  setInterval(() => {
    if (busy) return;
    busy = true;
    tick()
      .catch((error) => log.error("Library tick failed", error))
      .finally(() => {
        busy = false;
      });
  }, 5000);
};
