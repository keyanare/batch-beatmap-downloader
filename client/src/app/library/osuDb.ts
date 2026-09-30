import fs from "fs";

// Reader for osu!stable's osu!.db, the list of every beatmap in the Songs folder.
// https://github.com/ppy/osu/wiki/Legacy-database-file-structure#osudb

export interface OsuDbBeatmap {
  artist: string;
  title: string;
  creator: string;
  md5: string;
  status: number;
  /** When the .osu file was last changed, in ms since the epoch. */
  modified: number;
  beatmapId: number;
  setId: number;
  /** Relative to the Songs folder. */
  folder: string;
}

export interface OsuDb {
  version: number;
  beatmaps: OsuDbBeatmap[];
}

// .NET DateTime ticks at the unix epoch
const EPOCH_TICKS = 621355968000000000n;
const ticksToMs = (ticks: bigint) => (ticks > EPOCH_TICKS ? Number((ticks - EPOCH_TICKS) / 10000n) : 0);

// Versions where the layout changed
const FLOAT_DIFFICULTY = 20140609;
const NO_ENTRY_SIZE = 20191106;
const FLOAT_STAR_RATINGS = 20250107;

class Reader {
  offset = 0;
  constructor(private readonly buffer: Buffer) {}

  skip(bytes: number) {
    this.offset += bytes;
  }

  byte() {
    return this.buffer.readUInt8(this.offset++);
  }

  bool() {
    return this.byte() !== 0;
  }

  short() {
    const value = this.buffer.readInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  int() {
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  long() {
    const value = this.buffer.readBigInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  uleb128() {
    let result = 0;
    let shift = 0;
    for (;;) {
      const byte = this.byte();
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7;
    }
  }

  string() {
    const marker = this.byte();
    if (marker === 0x00) return "";
    if (marker !== 0x0b) throw new Error(`Invalid string marker ${marker} at ${this.offset - 1}`);
    const length = this.uleb128();
    const value = this.buffer.toString("utf8", this.offset, this.offset + length);
    this.offset += length;
    return value;
  }
}

const readBeatmap = (reader: Reader, version: number): OsuDbBeatmap => {
  if (version < NO_ENTRY_SIZE) reader.skip(4);

  const artist = reader.string();
  reader.string(); // artist unicode
  const title = reader.string();
  reader.string(); // title unicode
  const creator = reader.string();
  reader.string(); // difficulty name
  reader.string(); // audio file
  const md5 = reader.string();
  reader.string(); // .osu file name
  const status = reader.byte();
  reader.skip(6); // circle, slider and spinner counts
  const modified = ticksToMs(reader.long());
  reader.skip(version < FLOAT_DIFFICULTY ? 4 : 16); // AR, CS, HP, OD
  reader.skip(8); // slider velocity

  if (version >= FLOAT_DIFFICULTY) {
    // Star ratings per mod combination for each of the four modes
    const pairSize = version >= FLOAT_STAR_RATINGS ? 10 : 14;
    for (let mode = 0; mode < 4; mode++) reader.skip(reader.int() * pairSize);
  }

  reader.skip(12); // drain time, total time, preview time
  reader.skip(reader.int() * 17); // timing points
  const beatmapId = reader.int();
  const setId = reader.int();
  reader.skip(4); // thread id
  reader.skip(4); // grades
  reader.skip(2); // local offset
  reader.skip(4); // stack leniency
  reader.skip(1); // mode
  reader.string(); // source
  reader.string(); // tags
  reader.skip(2); // online offset
  reader.string(); // title font
  reader.skip(1); // unplayed
  reader.skip(8); // last played
  reader.skip(1); // osz2
  const folder = reader.string();
  reader.skip(8); // last checked online
  reader.skip(5); // ignore sound/skin, disable storyboard/video, visual override
  if (version < FLOAT_DIFFICULTY) reader.skip(2);
  reader.skip(4); // last modification time (again)
  reader.skip(1); // mania scroll speed

  return { artist, title, creator, md5, status, modified, beatmapId, setId, folder };
};

export const parseOsuDb = (buffer: Buffer): OsuDb => {
  const reader = new Reader(buffer);
  const version = reader.int();
  reader.skip(4); // folder count
  reader.skip(1 + 8); // account unlocked, unlock date
  reader.string(); // player name
  const count = reader.int();

  const beatmaps: OsuDbBeatmap[] = [];
  for (let i = 0; i < count; i++) {
    const beatmap = readBeatmap(reader, version);
    // A layout we don't understand shows up as garbage very quickly
    if (beatmap.md5 && !/^[0-9a-f]{32}$/i.test(beatmap.md5)) {
      throw new Error(`osu!.db version ${version} isn't supported`);
    }
    beatmaps.push(beatmap);
  }
  return { version, beatmaps };
};

export const readOsuDb = async (file: string) => parseOsuDb(await fs.promises.readFile(file));
