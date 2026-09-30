import fs from "fs";
import os from "os";
import path from "path";
import Realm from "realm";
import log from "electron-log/main";
import { LAZER_DATABASE } from "../paths";
import { Collection } from "../library/collectionDb";
import { LocalBeatmap } from "../library/types";

// Access to osu!lazer's realm database.
//
// Reads always happen on a temporary copy of client.realm, so nothing we do can
// interfere with a running game. Writes (collections) happen on the real file and
// are only done while the game is closed, after taking a backup.

interface BeatmapSetObject {
  OnlineID: number;
  DeletePending: boolean;
  Status: number;
  Beatmaps: Realm.List<BeatmapObject>;
}

interface BeatmapObject {
  OnlineID: number;
  MD5Hash: string | null;
  OnlineMD5Hash: string | null;
  LastLocalUpdate: Date | null;
  Metadata: { Artist: string | null; Title: string | null; Author: { Username: string | null } | null } | null;
}

// BeatmapOnlineStatus.LocallyModified: edited in the game's editor
const LOCALLY_MODIFIED = -4;

interface BeatmapCollectionObject {
  ID: Realm.BSON.UUID;
  Name: string | null;
  BeatmapMD5Hashes: Realm.List<string>;
  LastModified: Date;
}

export interface LazerSnapshot {
  setIds: Set<number>;
  /** MD5 hashes of every beatmap in the library. */
  hashes: Set<string>;
  collections: Collection[];
}

let cached: { key: string; snapshot: LazerSnapshot } | null = null;

const removeRealmFiles = async (file: string) => {
  const names = [file, `${file}.lock`, `${file}.note`, `${file}.management`, `${file}.fresh.lock`];
  await Promise.all(names.map((name) => fs.promises.rm(name, { recursive: true, force: true }).catch(() => undefined)));
};

const readSnapshot = (realm: Realm): LazerSnapshot => {
  const setIds = new Set<number>();
  for (const set of realm.objects<BeatmapSetObject>("BeatmapSet").filtered("DeletePending == false")) {
    if (set.OnlineID > 0) setIds.add(set.OnlineID);
  }

  const hashes = new Set<string>();
  for (const beatmap of realm.objects<BeatmapObject>("Beatmap").filtered("BeatmapSet.DeletePending == false")) {
    if (beatmap.MD5Hash) hashes.add(beatmap.MD5Hash);
  }

  const collections: Collection[] = realm.objects<BeatmapCollectionObject>("BeatmapCollection").map((collection) => ({
    name: collection.Name ?? "",
    hashes: [...collection.BeatmapMD5Hashes],
  }));

  return { setIds, hashes, collections };
};

/** Opens a temporary copy of the database, so a running game is never affected. */
const withCopy = async <T>(dataDir: string, read: (realm: Realm) => T): Promise<T> => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "bbd-realm-"));
  const copy = path.join(tempDir, LAZER_DATABASE);

  try {
    await fs.promises.copyFile(path.join(dataDir, LAZER_DATABASE), copy);
    const realm = new Realm({ path: copy, readOnly: true });
    try {
      return read(realm);
    } finally {
      realm.close();
    }
  } finally {
    await removeRealmFiles(copy);
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
};

export const readLazerDatabase = async (dataDir: string): Promise<LazerSnapshot> => {
  const source = path.join(dataDir, LAZER_DATABASE);
  const stat = await fs.promises.stat(source);
  const key = `${source}:${stat.size}:${stat.mtimeMs}`;
  if (cached?.key === key) return cached.snapshot;

  const snapshot = await withCopy(dataDir, readSnapshot);
  cached = { key, snapshot };
  return snapshot;
};

/** Every beatmap of the sets that came from the website, with what the game knows about their online version. */
export const readLazerBeatmaps = (dataDir: string) =>
  withCopy(dataDir, (realm) => {
    const beatmaps: LocalBeatmap[] = [];
    for (const set of realm.objects<BeatmapSetObject>("BeatmapSet").filtered("DeletePending == false AND OnlineID > 0")) {
      const modified = set.Status === LOCALLY_MODIFIED || set.Beatmaps.some((beatmap) => beatmap.LastLocalUpdate !== null);
      for (const beatmap of set.Beatmaps) {
        if (!beatmap.MD5Hash) continue;
        beatmaps.push({
          setId: set.OnlineID,
          beatmapId: beatmap.OnlineID,
          md5: beatmap.MD5Hash,
          onlineMd5: beatmap.OnlineMD5Hash ?? "",
          modified,
          artist: beatmap.Metadata?.Artist ?? "",
          title: beatmap.Metadata?.Title ?? "",
          creator: beatmap.Metadata?.Author?.Username ?? "",
        });
      }
    }
    return beatmaps;
  });

const EXPECTED_COLLECTION_SCHEMA: Record<string, string> = {
  ID: "uuid",
  Name: "string",
  BeatmapMD5Hashes: "list",
  LastModified: "date",
};

const openForWriting = async (dataDir: string) => {
  const file = path.join(dataDir, LAZER_DATABASE);
  await fs.promises.copyFile(file, `${file}.bbd-backup`);

  // Never let a newer realm library upgrade the file format, lazer wouldn't be able to open it anymore.
  const realm = new Realm({ path: file, disableFormatUpgrade: true });
  try {
    checkCollectionSchema(realm);
  } catch (error) {
    realm.close();
    throw error;
  }
  return realm;
};

const checkCollectionSchema = (realm: Realm) => {
  const schema = realm.schema.find((item) => item.name === "BeatmapCollection");
  if (!schema) throw new Error("This osu!lazer version doesn't store collections the way we expect");

  for (const [name, type] of Object.entries(EXPECTED_COLLECTION_SCHEMA)) {
    const property = schema.properties[name];
    if (!property || property.type !== type) {
      throw new Error(`Unsupported osu!lazer database (BeatmapCollection.${name} has changed)`);
    }
  }
};

/**
 * Adds beatmaps to a lazer collection, creating it if needed. Only call this while lazer is closed.
 * Returns the number of beatmaps added.
 */
export const addLazerCollection = async (dataDir: string, name: string, hashes: string[]) => {
  const realm = await openForWriting(dataDir);
  try {
    let added = 0;
    realm.write(() => {
      const unique = [...new Set(hashes.filter(Boolean))];
      const existing = realm.objects<BeatmapCollectionObject>("BeatmapCollection").filtered("Name == $0", name)[0];

      if (existing) {
        const current = new Set(existing.BeatmapMD5Hashes);
        const missing = unique.filter((hash) => !current.has(hash));
        existing.BeatmapMD5Hashes.push(...missing);
        existing.LastModified = new Date();
        added = missing.length;
      } else {
        realm.create("BeatmapCollection", {
          ID: new Realm.BSON.UUID(),
          Name: name,
          BeatmapMD5Hashes: unique,
          LastModified: new Date(),
        });
        added = unique.length;
      }
    });

    log.info(`Added ${added} beatmaps to lazer collection "${name}"`);
    return added;
  } finally {
    realm.close();
    cached = null;
  }
};

/**
 * Swaps beatmaps in every collection for another version of them (old hash -> new hash), like the game does
 * when it updates a map itself. Only call this while lazer is closed. Returns how many entries changed.
 */
export const replaceLazerCollectionHashes = async (dataDir: string, replacements: Map<string, string>) => {
  const realm = await openForWriting(dataDir);
  try {
    let replaced = 0;
    realm.write(() => {
      for (const collection of realm.objects<BeatmapCollectionObject>("BeatmapCollection")) {
        const current = [...collection.BeatmapMD5Hashes];
        if (!current.some((hash) => replacements.has(hash))) continue;

        const next = new Set<string>();
        for (const hash of current) {
          const value = replacements.get(hash) ?? hash;
          if (value !== hash) replaced++;
          next.add(value);
        }
        collection.BeatmapMD5Hashes.splice(0, collection.BeatmapMD5Hashes.length, ...next);
        collection.LastModified = new Date();
      }
    });

    log.info(`Swapped ${replaced} updated beatmaps in lazer collections`);
    return replaced;
  } finally {
    realm.close();
    cached = null;
  }
};
