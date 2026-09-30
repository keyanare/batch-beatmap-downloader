import crypto from "crypto";
import fs from "fs";
import { pipeline } from "stream/promises";
import zlib from "zlib";

// Checks that a downloaded .osz is a complete zip archive, and repairs a problem with some files on the
// download server: they were stored with the multipart/form-data envelope they were uploaded in, i.e.
//
//   ------------------------abc123\r\n
//   Content-Disposition: form-data; name="file"; filename="123 Artist - Title.osz"\r\n
//   Content-Type: application/octet-stream\r\n
//   \r\n
//   PK... (the actual archive)
//   \r\n------------------------abc123--\r\n
//
// Neither osu!stable nor osu!lazer can reliably read those, so the archive is cut out of them.

const LOCAL_FILE_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const EMPTY_ARCHIVE = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const END_OF_CENTRAL_DIRECTORY = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
// The end record is 22 bytes plus a comment of up to 65535 bytes
const MAX_END_RECORD = 22 + 0xffff;

const readAt = async (handle: fs.promises.FileHandle, position: number, length: number) => {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  return buffer.subarray(0, bytesRead);
};

/** Byte range of the archive inside a multipart envelope, or null if the file isn't wrapped. */
export const findWrappedArchive = async (file: string): Promise<{ start: number; end: number } | null> => {
  const handle = await fs.promises.open(file, "r");
  try {
    const { size } = await handle.stat();
    const head = await readAt(handle, 0, Math.min(size, 4096));
    if (head[0] !== 0x2d || head[1] !== 0x2d) return null; // "--"

    const lineEnd = head.indexOf("\r\n");
    const headersEnd = head.indexOf("\r\n\r\n");
    if (lineEnd <= 2 || headersEnd < 0) return null;

    const start = headersEnd + 4;
    if (!head.subarray(start, start + 4).equals(LOCAL_FILE_HEADER)) return null;

    const closing = Buffer.concat([Buffer.from("\r\n"), head.subarray(0, lineEnd)]);
    const tailLength = Math.min(size - start, closing.length + 64);
    const tail = await readAt(handle, size - tailLength, tailLength);
    const closingAt = tail.lastIndexOf(closing);
    if (closingAt < 0) return null;

    return { start, end: size - tailLength + closingAt };
  } finally {
    await handle.close();
  }
};

/** Whether the file starts like a zip and has an end of central directory record, i.e. isn't truncated. */
export const isCompleteZip = async (file: string) => {
  const handle = await fs.promises.open(file, "r");
  try {
    const { size } = await handle.stat();
    if (size < 22) return false;
    const head = await readAt(handle, 0, 4);
    if (!head.equals(LOCAL_FILE_HEADER) && !head.equals(EMPTY_ARCHIVE)) return false;
    const tailLength = Math.min(size, MAX_END_RECORD);
    const tail = await readAt(handle, size - tailLength, tailLength);
    return tail.lastIndexOf(END_OF_CENTRAL_DIRECTORY) >= 0;
  } finally {
    await handle.close();
  }
};

/**
 * Makes sure `file` is a usable archive, unwrapping it if needed. Returns false if it isn't one.
 */
export const repairArchive = async (file: string) => {
  const wrapped = await findWrappedArchive(file);
  if (wrapped) {
    const unwrapped = `${file}.unwrapped`;
    try {
      await pipeline(fs.createReadStream(file, { start: wrapped.start, end: wrapped.end - 1 }), fs.createWriteStream(unwrapped));
      await fs.promises.rename(unwrapped, file);
    } finally {
      await fs.promises.rm(unwrapped, { force: true });
    }
  }
  return isCompleteZip(file);
};

const CENTRAL_FILE_HEADER = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;

/** MD5 hashes of the .osu files in an archive, i.e. which versions of the difficulties it has. */
export const beatmapHashes = async (file: string) => {
  const hashes = new Set<string>();
  const handle = await fs.promises.open(file, "r");
  try {
    const { size } = await handle.stat();
    const tailLength = Math.min(size, MAX_END_RECORD);
    const tail = await readAt(handle, size - tailLength, tailLength);
    const end = tail.lastIndexOf(END_OF_CENTRAL_DIRECTORY);
    if (end < 0 || end + 22 > tail.length) return hashes;

    const entries = tail.readUInt16LE(end + 10);
    const directorySize = tail.readUInt32LE(end + 12);
    const directoryOffset = tail.readUInt32LE(end + 16);
    const directory = await readAt(handle, directoryOffset, directorySize);

    let offset = 0;
    for (let i = 0; i < entries && offset + 46 <= directory.length; i++) {
      if (directory.readUInt32LE(offset) !== CENTRAL_FILE_HEADER) break;
      const method = directory.readUInt16LE(offset + 10);
      const compressedSize = directory.readUInt32LE(offset + 20);
      const nameLength = directory.readUInt16LE(offset + 28);
      const extraLength = directory.readUInt16LE(offset + 30);
      const commentLength = directory.readUInt16LE(offset + 32);
      const localOffset = directory.readUInt32LE(offset + 42);
      const name = directory.toString("utf8", offset + 46, offset + 46 + nameLength);
      offset += 46 + nameLength + extraLength + commentLength;

      if (!name.toLowerCase().endsWith(".osu") || (method !== 0 && method !== 8)) continue;

      const local = await readAt(handle, localOffset, 30);
      if (local.length < 30 || local.readUInt32LE(0) !== LOCAL_HEADER) continue;
      const dataStart = localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      const data = await readAt(handle, dataStart, compressedSize);
      try {
        const content = method === 8 ? zlib.inflateRawSync(data) : data;
        hashes.add(crypto.createHash("md5").update(content).digest("hex"));
      } catch {
        // A broken entry just doesn't count
      }
    }
  } finally {
    await handle.close();
  }
  return hashes;
};
