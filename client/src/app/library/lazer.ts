import fs from "fs";
import path from "path";
import { app } from "electron";
import log from "electron-log/main";
import { AppSettings } from "../../models/ipc";
import { emitNotice } from "../events";
import { importWithExecutable, importWithPipe } from "../lazer/importer";
import { addLazerCollection, readLazerDatabase } from "../lazer/realm";
import { exists, isLazerFolder, listOszFiles, resolveExecutable, setIdFromName } from "../paths";
import { isLazerRunning } from "../processes";
import { Library } from "./types";

// Don't hand the same file to the game again while it's still busy importing it.
const RESEND_AFTER = 10 * 60 * 1000;
// Collect finished downloads for a moment so they're imported in batches.
const BATCH_DELAY = 3000;

export class LazerLibrary implements Library {
  readonly client = "lazer" as const;
  readonly root: string;

  private readonly sent = new Map<string, number>();
  private queued = new Set<string>();
  private flushTimer: NodeJS.Timeout | null = null;
  private importing = false;
  private readError: string | null = null;

  constructor(private readonly settings: AppSettings) {
    this.root = settings.lazerPath;
  }

  private get stagingDir() {
    return path.join(app.getPath("userData"), "lazer-import");
  }

  private async executable() {
    if (!this.settings.lazerExe) return null;
    const exe = await resolveExecutable(this.settings.lazerExe);
    return (await exists(exe)) ? exe : null;
  }

  warning() {
    return this.readError;
  }

  async validate() {
    if (!this.root) return "Choose your osu!lazer data folder";
    if (!(await isLazerFolder(this.root))) return "This doesn't look like an osu!lazer data folder (no client.realm)";
    return null;
  }

  isRunning() {
    return isLazerRunning();
  }

  async ownedSetIds() {
    const ids = new Set<number>();
    try {
      for (const id of (await readLazerDatabase(this.root)).setIds) ids.add(id);
      this.readError = null;
    } catch (error) {
      // Most likely a newer osu!lazer changed its database. Downloading still works, the game skips
      // maps it already has when importing, so keep going without knowing what's in the library.
      log.error("Couldn't read the osu!lazer database", error);
      this.readError = "Couldn't read your osu!lazer library, so maps you already have will be downloaded again";
    }

    // Downloaded but not imported yet
    for (const file of await this.pendingFiles()) {
      const id = setIdFromName(file);
      if (id) ids.add(id);
    }
    return ids;
  }

  async readCollections() {
    return (await readLazerDatabase(this.root)).collections;
  }

  writeCollection(name: string, hashes: string[]) {
    return addLazerCollection(this.root, name, hashes);
  }

  async downloadDir() {
    await fs.promises.mkdir(this.stagingDir, { recursive: true });
    return this.stagingDir;
  }

  pendingFiles() {
    return listOszFiles(this.stagingDir);
  }

  async canProcessPending() {
    return (await this.isRunning()) || (await this.executable()) !== null;
  }

  /** Hands files to the game. Starts the game when needed and possible. */
  private async importFiles(files: string[]) {
    if (!files.length) return;
    const now = Date.now();
    for (const file of files) {
      this.sent.set(file, now);
      this.queued.delete(file);
    }

    const exe = await this.executable();
    const running = await this.isRunning();
    if (exe) {
      await importWithExecutable(exe, files, running);
    } else if (running) {
      await importWithPipe(files);
    } else {
      for (const file of files) this.sent.delete(file);
      throw new Error("Start osu!lazer (or set where osu!.exe is in settings) to import the downloaded maps");
    }
  }

  async processPending() {
    // An explicit request, so resend everything that's still waiting
    await this.importFiles(await this.pendingFiles());
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushQueue().catch((error: Error) => log.error("Importing into lazer failed", error));
    }, BATCH_DELAY);
  }

  private async flushQueue() {
    if (this.importing || !this.queued.size) return;
    // Only import automatically while the game is open, we don't want to start it by surprise.
    if (!(await this.isRunning())) return;

    const now = Date.now();
    const files = [...this.queued].filter(
      (file) => fs.existsSync(file) && now - (this.sent.get(file) ?? 0) > RESEND_AFTER,
    );
    this.queued = new Set();
    this.importing = true;
    try {
      await this.importFiles(files);
    } finally {
      this.importing = false;
    }
  }

  onSetDownloaded(file: string) {
    if (!this.settings.lazerAutoImport) return;
    this.queued.add(file);
    this.scheduleFlush();
  }

  async onDownloadsFinished() {
    await this.flushQueue();
  }

  async tick() {
    if (!this.settings.lazerAutoImport || this.importing) return;

    const pending = await this.pendingFiles();
    if (!pending.length) return;

    const now = Date.now();
    const unsent = pending.filter((file) => now - (this.sent.get(file) ?? 0) > RESEND_AFTER);
    if (!unsent.length || !(await this.isRunning())) return;

    this.importing = true;
    try {
      await this.importFiles(unsent);
      emitNotice({ type: "info", message: `Importing ${unsent.length} beatmap set(s) into osu!lazer` });
    } catch (error) {
      log.error("Background import into lazer failed", error);
    } finally {
      this.importing = false;
    }
  }
}
