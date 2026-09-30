import log from "electron-log/main";
import { GameClient, MapUpdate, MapUpdateCheck } from "../models/ipc";
import { createDownload } from "./download/manager";
import { emitNotice } from "./events";
import { getLibrary } from "./library";
import { Library, LocalBeatmap } from "./library/types";
import { getBeatmapset } from "./osuWeb";
import { getServerSets, ServerSet, tryServerSets } from "./server";
import { getValue, setValue } from "./store";

// Finds sets in the library that have a newer version on the website and updates them all at once.
//
// osu!lazer remembers the hash of every difficulty's online version from the last time it looked, so an update
// is anything where that differs from what's installed. osu!stable doesn't, so sets whose difficulties don't
// match what the server has are looked up on the website.
//
// Updating means downloading the set again, from the mirrors first: the server often has the old version
// (that's usually where the outdated copy came from), and every archive is checked for the new difficulties
// before it's used. lazer replaces the old version itself and keeps the scores (they're
// stored by hash). For stable the old folder is moved out of Songs. Neither game moves updated difficulties
// along in collections, so that happens here afterwards, once the game is closed.

// stable sets looked up on the website per check, each one is a request
const MAX_LOOKUPS = 200;
// Collection fixes for updates that never made it into the game are given up on after this
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const STATE_KEY = "mapUpdates";

interface Planned {
  setId: number;
  size: number;
  /** Old hash -> new hash of every difficulty that changed */
  replacements: [string, string][];
  /** stable: folders of the old version */
  folders: string[];
}

interface Replacement {
  client: GameClient;
  root: string;
  setId: number;
  from: string;
  to: string;
  /** stable: the new version was downloaded. lazer checks its database instead. */
  ready: boolean;
  added: number;
}

interface State {
  replacements: Replacement[];
  /** stable: set id -> folders to move out of Songs once its new version is downloaded */
  retire: Record<string, { client: GameClient; root: string; folders: string[] }>;
}

let state: State | null = null;

const loadState = async () => {
  if (!state) {
    const stored = await getValue<Partial<State>>(STATE_KEY);
    state = { replacements: stored?.replacements ?? [], retire: stored?.retire ?? {} };
  }
  return state;
};

const saveState = () => setValue(STATE_KEY, state);

let lastCheck: { client: GameClient; root: string; planned: Planned[] } | null = null;

const groupBySet = (beatmaps: LocalBeatmap[]) => {
  const sets = new Map<number, LocalBeatmap[]>();
  for (const beatmap of beatmaps) {
    let set = sets.get(beatmap.setId);
    if (!set) sets.set(beatmap.setId, (set = []));
    set.push(beatmap);
  }
  return sets;
};

/** Folders that only hold this set, so moving them can't take anything else along. */
const ownFolders = (setId: number, diffs: LocalBeatmap[], setsByFolder: Map<string, Set<number>>) =>
  [...new Set(diffs.map((diff) => diff.folder).filter((folder): folder is string => Boolean(folder)))].filter(
    (folder) => setsByFolder.get(folder)?.size === 1 && setsByFolder.get(folder)?.has(setId),
  );

export const checkMapUpdates = async (): Promise<MapUpdateCheck> => {
  const library = await getLibrary();
  // lazer knows which of its maps are outdated by itself, the server only tells how big they are.
  // stable's maps are compared against the server's list, so that one has to be there.
  const [beatmaps, serverSets] = await Promise.all([
    library.localBeatmaps(),
    library.client === "lazer" ? tryServerSets() : getServerSets(),
  ]);
  const sets = groupBySet(beatmaps);

  const setsByFolder = new Map<string, Set<number>>();
  for (const beatmap of beatmaps) {
    if (!beatmap.folder) continue;
    let folderSets = setsByFolder.get(beatmap.folder);
    if (!folderSets) setsByFolder.set(beatmap.folder, (folderSets = new Set()));
    folderSets.add(beatmap.setId);
  }

  const planned: Planned[] = [];
  const updates: MapUpdate[] = [];
  let unchecked = 0;
  let edited = 0;

  const plan = (setId: number, diffs: LocalBeatmap[], server: ServerSet | undefined, changes: [LocalBeatmap, string][]) => {
    if (!changes.length) return;
    planned.push({
      setId,
      // Mirrors don't say how big a set is, the server's copy is close enough when it has one
      size: server?.size ?? 0,
      replacements: changes.map(([diff, hash]) => [diff.md5, hash]),
      folders: ownFolders(setId, diffs, setsByFolder),
    });
    const [first] = diffs;
    updates.push({ setId, artist: first.artist, title: first.title, creator: first.creator, size: server?.size ?? 0 });
  };

  const lookups: [number, LocalBeatmap[], ServerSet][] = [];

  for (const [setId, diffs] of sets) {
    if (diffs.some((diff) => diff.modified)) {
      edited++;
      continue;
    }
    const server = serverSets.get(setId);

    if (diffs[0].onlineMd5 !== undefined) {
      // lazer already knows
      const changes = diffs.filter((diff) => diff.onlineMd5 && diff.onlineMd5 !== diff.md5);
      plan(setId, diffs, server, changes.map((diff) => [diff, diff.onlineMd5 ?? ""]));
      continue;
    }

    if (!server) continue;
    const unknown = diffs.filter((diff) => diff.beatmapId > 0 && !server.hashes.has(diff.md5));
    // The server doesn't list every difficulty of every set, only a set it lists completely says anything
    if (unknown.length && diffs.length <= server.hashes.size) lookups.push([setId, diffs, server]);
  }

  for (const [index, [setId, diffs, server]] of lookups.entries()) {
    if (index >= MAX_LOOKUPS) {
      unchecked += lookups.length - index;
      break;
    }
    try {
      const online = await getBeatmapset(setId);
      if (!online) continue;
      const hashes = new Map(online.beatmaps.map((beatmap) => [beatmap.id, beatmap.checksum]));
      const changes = diffs.flatMap((diff): [LocalBeatmap, string][] => {
        const hash = hashes.get(diff.beatmapId);
        return hash && hash !== diff.md5 ? [[diff, hash]] : [];
      });
      plan(setId, diffs, server, changes);
    } catch (error) {
      log.warn(`Couldn't check set ${setId} for updates: ${(error as Error).message}`);
      unchecked++;
    }
  }

  lastCheck = { client: library.client, root: library.root, planned };
  updates.sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
  log.info(`Map updates: ${updates.length} of ${sets.size} sets, ${unchecked} unchecked`);

  return {
    checked: sets.size,
    updates,
    totalSize: planned.reduce((sum, set) => sum + set.size, 0),
    unchecked,
    edited,
  };
};

export const downloadMapUpdates = async () => {
  const library = await getLibrary();
  if (!lastCheck || lastCheck.client !== library.client || lastCheck.root !== library.root || !lastCheck.planned.length) {
    throw new Error("Check for updates first");
  }
  if (library.client === "stable" && (await library.isRunning())) {
    throw new Error("Close osu! first, otherwise it shows the old and the new versions side by side");
  }

  const { planned } = lastCheck;
  lastCheck = null;

  const current = await loadState();
  const added = Date.now();
  for (const set of planned) {
    for (const [from, to] of set.replacements) {
      current.replacements.push({ client: library.client, root: library.root, setId: set.setId, from, to, ready: false, added });
    }
    if (set.folders.length) current.retire[set.setId] = { client: library.client, root: library.root, folders: set.folders };
  }
  await saveState();

  return createDownload({
    name: "Map updates",
    metricsId: crypto.randomUUID(),
    ids: planned.map((set) => set.setId),
    sizes: Object.fromEntries(planned.map((set) => [set.setId, set.size])),
    force: true,
    expected: Object.fromEntries(planned.map((set) => [set.setId, set.replacements.map(([, to]) => to)])),
    mirrorsFirst: true,
  });
};

/** A set was downloaded. If it's an update, the old version makes room for it. */
export const onSetDownloaded = async (setId: number) => {
  const current = await loadState();
  const retire = current.retire[setId];
  const replacements = current.replacements.filter((item) => item.setId === setId && !item.ready);
  if (!retire && !replacements.length) return;

  const library = await getLibrary();
  if (retire && retire.client === library.client && retire.root === library.root) {
    await library.retireFolders?.(retire.folders);
  }
  delete current.retire[setId];
  for (const item of replacements) item.ready = true;
  await saveState();
};

let fixing = false;

/** Moves updated difficulties along in collections. Only call this while the game is closed. */
export const fixUpdatedCollections = async (library: Library) => {
  if (fixing) return;
  const current = await loadState();
  const now = Date.now();
  const fresh = current.replacements.filter((item) => now - item.added < MAX_AGE);
  const mine = fresh.filter((item) => item.client === library.client && item.root === library.root);
  if (fresh.length !== current.replacements.length) {
    current.replacements = fresh;
    await saveState();
  }
  if (!mine.length) return;

  fixing = true;
  try {
    // lazer: once the game imported the new version. stable: once it's downloaded.
    const present = library.client === "lazer" ? await library.presentHashes() : null;
    const ready = mine.filter((item) => (present ? present.has(item.to) : item.ready));
    if (!ready.length) return;

    const replaced = await library.replaceCollectionHashes(new Map(ready.map((item) => [item.from, item.to])));
    current.replacements = current.replacements.filter((item) => !ready.includes(item));
    await saveState();
    if (replaced) {
      emitNotice({ type: "success", message: `Moved ${replaced} updated beatmap(s) in your collections to their new version` });
    }
  } finally {
    fixing = false;
  }
};
