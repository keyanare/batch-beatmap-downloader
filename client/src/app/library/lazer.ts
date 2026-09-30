import fs from "fs";
import path from "path";
import { app } from "electron";
import log from "electron-log/main";
import { AppSettings } from "../../models/ipc";
import { importWithExecutable, importWithPipe } from "../lazer/importer";
import { importProgress, pumpImports } from "../lazer/importQueue";
import { addLazerCollection, readLazerDatabase } from "../lazer/realm";
import { exists, isLazerFolder, listOszFiles, resolveExecutable, setIdFromName } from "../paths";
import { isLazerRunning } from "../processes";
import { Library } from "./types";

// Collect finished downloads for a moment before looking whether the game wants more
const PUMP_DELAY = 3000;

export class LazerLibrary implements Library {
  readonly client = "lazer" as const;
  readonly root: string;

  private pumpTimer: NodeJS.Timeout | null = null;
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

  /** Hands files to the game. Starts the game if it isn't running and the executable is known. */
  private readonly send = async (files: string[], running: boolean) => {
    const exe = await this.executable();
    if (exe) await importWithExecutable(exe, files, running);
    else if (running) await importWithPipe(files);
    else throw new Error("Start osu!lazer (or set where osu!.exe is in settings) to import the downloaded maps");
  };

  importProgress() {
    return importProgress(this.stagingDir);
  }

  processPending() {
    // Asked for, so this also retries files that failed and starts the game if needed
    return pumpImports(this.stagingDir, this.send, true);
  }

  private pump() {
    if (!this.settings.lazerAutoImport) return Promise.resolve(0);
    return pumpImports(this.stagingDir, this.send, false);
  }

  onSetDownloaded() {
    if (!this.settings.lazerAutoImport || this.pumpTimer) return;
    this.pumpTimer = setTimeout(() => {
      this.pumpTimer = null;
      this.pump().catch((error: Error) => log.error("Importing into lazer failed", error));
    }, PUMP_DELAY);
  }

  async onDownloadsFinished() {
    await this.pump();
  }

  async tick() {
    try {
      await this.pump();
    } catch (error) {
      log.error("Background import into lazer failed", error);
    }
  }
}
