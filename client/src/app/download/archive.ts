import fs from "fs";
import { pipeline } from "stream/promises";

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
