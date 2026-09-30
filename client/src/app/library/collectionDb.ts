import fs from "fs";

// Reader/writer for osu!stable's collection.db.
// https://github.com/ppy/osu/wiki/Legacy-database-file-structure#collectiondb

export interface Collection {
  name: string;
  hashes: string[];
}

export interface CollectionDb {
  version: number;
  collections: Collection[];
}

class Reader {
  private offset = 0;
  constructor(private readonly buffer: Buffer) {}

  int32() {
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  uleb128() {
    let result = 0;
    let shift = 0;
    for (;;) {
      const byte = this.buffer.readUInt8(this.offset++);
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7;
    }
  }

  string() {
    const marker = this.buffer.readUInt8(this.offset++);
    if (marker === 0x00) return "";
    if (marker !== 0x0b) throw new Error(`Invalid string marker ${marker} at ${this.offset - 1}`);
    const length = this.uleb128();
    const value = this.buffer.toString("utf8", this.offset, this.offset + length);
    this.offset += length;
    return value;
  }
}

const uleb128 = (value: number) => {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (value !== 0);
  return Buffer.from(bytes);
};

const int32 = (value: number) => {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32LE(value);
  return buffer;
};

const string = (value: string) => {
  if (!value) return Buffer.from([0x00]);
  const bytes = Buffer.from(value, "utf8");
  return Buffer.concat([Buffer.from([0x0b]), uleb128(bytes.length), bytes]);
};

export const parseCollectionDb = (buffer: Buffer): CollectionDb => {
  const reader = new Reader(buffer);
  const version = reader.int32();
  const count = reader.int32();
  const collections: Collection[] = [];

  for (let i = 0; i < count; i++) {
    const name = reader.string();
    const size = reader.int32();
    const hashes: string[] = [];
    for (let j = 0; j < size; j++) hashes.push(reader.string());
    collections.push({ name, hashes });
  }

  return { version, collections };
};

export const serializeCollectionDb = (db: CollectionDb) => {
  const parts: Buffer[] = [int32(db.version), int32(db.collections.length)];
  for (const collection of db.collections) {
    parts.push(string(collection.name), int32(collection.hashes.length));
    for (const hash of collection.hashes) parts.push(string(hash));
  }
  return Buffer.concat(parts);
};

export const readCollectionDb = async (file: string, fallbackVersion: number): Promise<CollectionDb> => {
  try {
    return parseCollectionDb(await fs.promises.readFile(file));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: fallbackVersion, collections: [] };
    throw error;
  }
};

/**
 * Adds hashes to the collection called `name`, creating it if it doesn't exist.
 * Returns how many hashes were new.
 */
export const mergeCollection = (db: CollectionDb, name: string, hashes: string[]) => {
  let collection = db.collections.find((item) => item.name === name);
  if (!collection) {
    collection = { name, hashes: [] };
    db.collections.push(collection);
  }

  const existing = new Set(collection.hashes);
  let added = 0;
  for (const hash of hashes) {
    if (!hash || existing.has(hash)) continue;
    existing.add(hash);
    collection.hashes.push(hash);
    added++;
  }
  return added;
};

/** Swaps hashes in every collection (old -> new), returns how many entries changed. */
export const replaceHashes = (db: CollectionDb, replacements: Map<string, string>) => {
  let replaced = 0;
  for (const collection of db.collections) {
    if (!collection.hashes.some((hash) => replacements.has(hash))) continue;
    const next = new Set<string>();
    for (const hash of collection.hashes) {
      const value = replacements.get(hash) ?? hash;
      if (value !== hash) replaced++;
      next.add(value);
    }
    collection.hashes = [...next];
  }
  return replaced;
};

/** Writes via a temp file so a crash never leaves a half written collection.db behind. */
export const writeCollectionDb = async (file: string, db: CollectionDb) => {
  const buffer = serializeCollectionDb(db);
  // Make sure what we are about to write reads back to the same thing.
  const check = parseCollectionDb(buffer);
  if (check.collections.length !== db.collections.length) throw new Error("collection.db failed verification");

  const temp = `${file}.bbd-tmp`;
  await fs.promises.writeFile(temp, buffer);
  await fs.promises.rename(temp, file);
};
