import fs from "fs";
import path from "path";
import log from "electron-log/main";
import { AppSettings } from "../../models/ipc";
import { exists, isDirectory, isStableFolder, listOszFiles, moveFile, setIdFromName } from "../paths";
import { isStableRunning } from "../processes";
import { mergeCollection, readCollectionDb, replaceHashes, writeCollectionDb } from "./collectionDb";
import { OsuDb, readOsuDb } from "./osuDb";
import { Library, LocalBeatmap } from "./types";

// Version written into a brand new collection.db when osu!.db can't tell us the client version.
const DEFAULT_DB_VERSION = 20240820;

// Where the folders of updated sets go, next to the Songs folder
const OLD_VERSIONS = "bbd-old-versions";

let osuDbCache: { key: string; db: OsuDb } | null = null;

export class StableLibrary implements Library {
  readonly client = "stable" as const;
  readonly root: string;

  constructor(private readonly settings: AppSettings) {
    this.root = settings.path;
  }

  private get songsDir() {
    return this.settings.altPathEnabled && this.settings.altPath
      ? this.settings.altPath
      : path.join(this.root, "Songs");
  }

  private get tempDir() {
    return this.settings.tempPath || path.join(path.dirname(this.songsDir), "bbd-temp");
  }

  private get collectionDb() {
    return path.join(this.root, "collection.db");
  }

  warning() {
    return null;
  }

  async validate() {
    if (!this.root) return "Choose your osu! folder";
    if (!(await isStableFolder(this.root))) return "This doesn't look like an osu!stable folder (no osu!.exe or Songs folder)";
    if (this.settings.altPathEnabled) {
      if (!this.settings.altPath) return "Choose your custom Songs folder";
      if (!(await isDirectory(this.settings.altPath))) return "The custom Songs folder doesn't exist";
    }
    return null;
  }

  isRunning() {
    return isStableRunning(this.root);
  }

  async ownedSetIds() {
    const ids = new Set<number>();
    // Maps in the temp folder count too, even if it was turned off since
    const folders = [this.songsDir, this.tempDir];

    for (const folder of folders) {
      try {
        for (const name of await fs.promises.readdir(folder)) {
          const id = setIdFromName(name);
          if (id) ids.add(id);
        }
      } catch (error) {
        // The temp folder only exists once something was downloaded into it
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") log.warn(`Couldn't read ${folder}: ${(error as Error).message}`);
      }
    }
    return ids;
  }

  async readCollections() {
    return (await readCollectionDb(this.collectionDb, DEFAULT_DB_VERSION)).collections;
  }

  private async clientVersion() {
    try {
      const handle = await fs.promises.open(path.join(this.root, "osu!.db"), "r");
      try {
        const { buffer } = await handle.read(Buffer.alloc(4), 0, 4, 0);
        return buffer.readInt32LE(0) || DEFAULT_DB_VERSION;
      } finally {
        await handle.close();
      }
    } catch {
      return DEFAULT_DB_VERSION;
    }
  }

  private async osuDb() {
    const file = path.join(this.root, "osu!.db");
    const stat = await fs.promises.stat(file);
    const key = `${file}:${stat.size}:${stat.mtimeMs}`;
    if (osuDbCache?.key !== key) osuDbCache = { key, db: await readOsuDb(file) };
    return osuDbCache.db;
  }

  async localBeatmaps(): Promise<LocalBeatmap[]> {
    return (await this.osuDb()).beatmaps
      .filter((beatmap) => beatmap.setId > 0 && beatmap.md5)
      .map((beatmap) => ({
        setId: beatmap.setId,
        beatmapId: beatmap.beatmapId,
        md5: beatmap.md5,
        modified: false,
        folder: beatmap.folder,
        artist: beatmap.artist,
        title: beatmap.title,
        creator: beatmap.creator,
      }));
  }

  async presentHashes() {
    return new Set((await this.osuDb()).beatmaps.map((beatmap) => beatmap.md5));
  }

  async retireFolders(folders: string[]) {
    const target = path.join(path.dirname(this.songsDir), OLD_VERSIONS);
    await fs.promises.mkdir(target, { recursive: true });
    for (const folder of folders) {
      const from = path.join(this.songsDir, folder);
      if (!folder || !(await isDirectory(from))) continue;
      let to = path.join(target, folder);
      for (let i = 2; await exists(to); i++) to = path.join(target, `${folder} (${i})`);
      try {
        await fs.promises.rename(from, to);
      } catch (error) {
        // Songs folder on another drive
        if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
        await fs.promises.cp(from, to, { recursive: true });
        await fs.promises.rm(from, { recursive: true, force: true });
      }
      log.info(`Moved the old version of ${folder} to ${target}`);
    }
  }

  async replaceCollectionHashes(replacements: Map<string, string>) {
    const db = await readCollectionDb(this.collectionDb, await this.clientVersion());
    const replaced = replaceHashes(db, replacements);
    if (!replaced) return 0;
    await fs.promises.copyFile(this.collectionDb, `${this.collectionDb}.bbd-backup`);
    await writeCollectionDb(this.collectionDb, db);
    log.info(`Swapped ${replaced} updated beatmaps in stable collections`);
    return replaced;
  }

  async writeCollection(name: string, hashes: string[]) {
    const db = await readCollectionDb(this.collectionDb, await this.clientVersion());
    if (await exists(this.collectionDb)) {
      await fs.promises.copyFile(this.collectionDb, `${this.collectionDb}.bbd-backup`);
    }
    const added = mergeCollection(db, name, hashes);
    await writeCollectionDb(this.collectionDb, db);
    log.info(`Added ${added} beatmaps to stable collection "${name}"`);
    return added;
  }

  async downloadDir() {
    const dir = this.settings.temp ? this.tempDir : this.songsDir;
    await fs.promises.mkdir(dir, { recursive: true });
    return dir;
  }

  pendingFiles() {
    return listOszFiles(this.tempDir);
  }

  canProcessPending() {
    return Promise.resolve(true);
  }

  async processPending() {
    const files = await this.pendingFiles();
    if (!files.length) return 0;

    await fs.promises.mkdir(this.songsDir, { recursive: true });
    const failures: string[] = [];
    for (const file of files) {
      try {
        await moveFile(file, path.join(this.songsDir, path.basename(file)));
      } catch (error) {
        failures.push(path.basename(file));
        log.error(`Couldn't move ${file}: ${(error as Error).message}`);
      }
    }

    if (failures.length) throw new Error(`Couldn't move ${failures.length} file(s) into your Songs folder`);
    return files.length;
  }

  onSetDownloaded() {
    // osu!stable imports .osz files in its Songs folder by itself
  }

  async onDownloadsFinished() {
    if (this.settings.temp && this.settings.autoTemp) await this.processPending();
  }

  async tick() {
    // Nothing to do in the background
  }
}
