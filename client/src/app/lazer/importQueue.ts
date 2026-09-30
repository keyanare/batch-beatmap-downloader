import fs from "fs";
import path from "path";
import log from "electron-log/main";
import { listOszFiles } from "../paths";
import { isLazerRunning, lazerProcessId } from "../processes";

// Feeds downloaded .osz files to osu!lazer a batch at a time and keeps track of what it was given.
//
// Lazer imports one file after another and pauses imports completely while you play, so a big download
// can take hours to get through. It deletes each .osz once it's imported, and forgets everything it hadn't
// got to yet when it closes. So:
// - a file that was handed to the game is never handed to it again while that same game process runs,
//   no matter how long it takes. Only a restarted game gets the leftovers again.
// - at most WINDOW files wait in the game's queue at a time, so it isn't flooded and a restart loses little.
// - files that are still around after the game got through later batches failed to import. They're only
//   retried when asked to, not even when the game restarts. A retried file that's still around after a
//   while failed again: nothing handed over after it has to show that it's done.
// The state lives in a file next to the downloads, so restarting this app doesn't cause duplicates either.

const WINDOW = 100;
const LOW_WATER = 25;
const STATE_FILE = ".bbd-imports.json";
// A game we started ourselves has this long to show up before it counts as a different instance
const LAUNCH_GRACE = 3 * 60 * 1000;
const LAUNCHING = "launching";
const RETRY_TIMEOUT = 5 * 60 * 1000;

interface ImportState {
  /** Process id of the game the files were handed to; its queue dies with it. */
  pid: string | null;
  launchedAt: number;
  nextBatch: number;
  /** Highest batch the game got through completely. */
  completedBatch: number;
  /** File name -> batch it was handed over in */
  sent: Record<string, number>;
  /** Files the game didn't manage to import in an earlier session. */
  failed: string[];
  /** Failed files handed over again -> when */
  retried: Record<string, number>;
}

export interface ImportProgress {
  /** Handed to the game, which hasn't got to them yet. */
  importing: number;
  /** Still here although the game already imported files handed over after them. */
  failed: number;
}

const initialState = (): ImportState => ({
  pid: null,
  launchedAt: 0,
  nextBatch: 1,
  completedBatch: 0,
  sent: {},
  failed: [],
  retried: {},
});

let lastSeenRunning: boolean | null = null;
let busy = false;

const load = async (dir: string): Promise<ImportState> => {
  try {
    const parsed = JSON.parse(await fs.promises.readFile(path.join(dir, STATE_FILE), "utf8")) as Partial<ImportState>;
    return {
      ...initialState(),
      ...parsed,
      sent: parsed.sent ?? {},
      failed: parsed.failed ?? [],
      retried: parsed.retried ?? {},
    };
  } catch {
    return initialState();
  }
};

const save = async (dir: string, state: ImportState) => {
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, STATE_FILE), JSON.stringify(state));
};

/** Takes note of what the game finished since last time. */
const reconcile = (state: ImportState, present: Set<string>) => {
  const remaining = new Map<number, boolean>();
  for (const [name, batch] of Object.entries(state.sent)) {
    remaining.set(batch, (remaining.get(batch) ?? false) || present.has(name));
  }
  for (const [batch, left] of remaining) {
    if (!left) state.completedBatch = Math.max(state.completedBatch, batch);
  }
  for (const name of Object.keys(state.sent)) {
    if (!present.has(name)) delete state.sent[name];
  }
  state.failed = state.failed.filter((name) => present.has(name));
  for (const name of Object.keys(state.retried)) {
    if (!present.has(name)) delete state.retried[name];
  }
};

const classify = (state: ImportState, files: string[]) => {
  const fresh: string[] = [];
  const importing: string[] = [];
  const failed: string[] = [];
  const failedBefore = new Set(state.failed);
  for (const file of files) {
    const name = path.basename(file);
    const batch = state.sent[name];
    if (batch === undefined) (failedBefore.has(name) ? failed : fresh).push(file);
    else if (batch < state.completedBatch || Date.now() - (state.retried[name] ?? Infinity) > RETRY_TIMEOUT)
      failed.push(file);
    else importing.push(file);
  }
  return { fresh, importing, failed };
};

/** The game's queue is gone, whatever it hadn't imported yet has to be handed over again. */
const forgetSession = (state: ImportState) => {
  const failed = Object.entries(state.sent)
    .filter(([name, batch]) => batch < state.completedBatch || state.retried[name] !== undefined)
    .map(([name]) => name);
  state.failed = [...new Set([...state.failed, ...failed])];
  state.sent = {};
  state.retried = {};
  state.pid = null;
  state.launchedAt = 0;
  state.completedBatch = state.nextBatch - 1;
};

const readState = async (dir: string) => {
  const files = await listOszFiles(dir);
  const state = await load(dir);
  reconcile(state, new Set(files.map((file) => path.basename(file))));
  return { files, state };
};

export const importProgress = async (dir: string): Promise<ImportProgress> => {
  const { files, state } = await readState(dir);
  const { importing, failed } = classify(state, files);
  return { importing: importing.length, failed: failed.length };
};

type Send = (files: string[], running: boolean) => Promise<void>;

/**
 * Hands the next batch of files to the game if it's ready for more. `explicit` is a user's request:
 * it also retries failed files and may start the game. Returns how many files were handed over.
 */
export const pumpImports = async (dir: string, send: Send, explicit: boolean) => {
  if (busy) return 0;
  busy = true;
  try {
    const { files, state } = await readState(dir);
    const running = await isLazerRunning();

    if (running) {
      const pid = await lazerProcessId();
      const launchedByUs = state.pid === LAUNCHING && Date.now() - state.launchedAt < LAUNCH_GRACE;
      const restarted =
        !launchedByUs && (lastSeenRunning === false || (pid !== null && state.pid !== null && state.pid !== pid));
      if (restarted) forgetSession(state);
      if (pid !== null) state.pid = pid;
      else if (state.pid === LAUNCHING && !launchedByUs) state.pid = null;
    } else if (lastSeenRunning === true) {
      forgetSession(state);
    }
    lastSeenRunning = running;

    const { fresh, importing, failed } = classify(state, files);

    // Automatically only while the game is open, and only once it got through most of what it has
    if (!explicit && (!running || importing.length >= LOW_WATER)) {
      await save(dir, state);
      return 0;
    }

    const room = Math.max(0, WINDOW - (running ? importing.length : 0));
    const batch = explicit ? [...failed, ...fresh.slice(0, room)] : fresh.slice(0, room);
    if (!batch.length) {
      await save(dir, state);
      return 0;
    }

    const id = state.nextBatch++;
    const names = new Set(batch.map((file) => path.basename(file)));
    for (const name of names) state.sent[name] = id;
    const before = { failed: state.failed, retried: { ...state.retried } };
    for (const file of failed) if (names.has(path.basename(file))) state.retried[path.basename(file)] = Date.now();
    state.failed = state.failed.filter((name) => !names.has(name));
    if (!running) {
      state.pid = LAUNCHING;
      state.launchedAt = Date.now();
    }
    await save(dir, state);

    try {
      await send(batch, running);
    } catch (error) {
      // Nothing reached the game, so nothing is waiting in its queue
      for (const name of names) delete state.sent[name];
      state.failed = before.failed;
      state.retried = before.retried;
      await save(dir, state).catch(() => undefined);
      throw error;
    }

    log.info(`Handed ${batch.length} beatmap sets to osu!lazer (batch ${id}, ${importing.length} already queued)`);
    return batch.length;
  } finally {
    busy = false;
  }
};
