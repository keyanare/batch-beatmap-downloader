import { net } from "electron";
import fs from "fs";
import path from "path";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as NodeReadableStream } from "stream/web";
import { DOWNLOAD_BASE, userAgent } from "../server";
import { repairArchive } from "./archive";

export type DownloadErrorKind =
  /** The server doesn't have this set, retrying won't help. */
  | "missing"
  /** Network problems or server errors, worth retrying later. */
  | "network"
  /** The server sent something that isn't a beatmap archive. */
  | "invalid"
  /** The file couldn't be written, e.g. the disk is full. */
  | "disk"
  | "aborted";

export class DownloadError extends Error {
  constructor(message: string, readonly kind: DownloadErrorKind) {
    super(message);
  }
}

interface FetchOptions {
  signal: AbortSignal;
  /** Called with the number of bytes received so far. */
  onProgress: (bytes: number) => void;
}

export interface FetchedSet {
  file: string;
  bytes: number;
}

const ATTEMPTS = 3;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new DownloadError("Aborted", "aborted"));
    });
  });

const attempt = async (setId: number, dir: string, { signal, onProgress }: FetchOptions): Promise<FetchedSet> => {
  const file = path.join(dir, `${setId}.osz`);
  // osu!stable picks up any .osz in its Songs folder, so never expose unfinished files under that name
  const partial = `${file}.part`;

  let response: Response;
  try {
    response = await net.fetch(`${DOWNLOAD_BASE}/${setId}.osz`, {
      signal,
      cache: "no-store",
      headers: { "User-Agent": userAgent() },
    });
  } catch (error) {
    if (signal.aborted) throw new DownloadError("Aborted", "aborted");
    throw new DownloadError((error as Error).message, "network");
  }

  if (response.status === 404) throw new DownloadError("Not available on the download server", "missing");
  if (!response.ok || !response.body) {
    const retryable = response.status >= 500 || response.status === 429 || response.status === 408;
    throw new DownloadError(`Server responded with ${response.status}`, retryable ? "network" : "missing");
  }

  const expected = Number(response.headers.get("content-length")) || 0;
  let bytes = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      onProgress(bytes);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>),
      counter,
      fs.createWriteStream(partial),
      { signal },
    );

    if (expected && bytes !== expected) throw new DownloadError("Download was cut off", "network");
    if (!(await repairArchive(partial))) throw new DownloadError("The server sent a broken beatmap archive", "invalid");

    await fs.promises.rename(partial, file);
    return { file, bytes };
  } catch (error) {
    await fs.promises.rm(partial, { force: true }).catch(() => undefined);
    if (signal.aborted) throw new DownloadError("Aborted", "aborted");
    if (error instanceof DownloadError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    // Problems writing to disk won't fix themselves
    if (code && ["ENOSPC", "EACCES", "EPERM", "EROFS", "ENOENT"].includes(code)) {
      throw new DownloadError(`Couldn't save the beatmap (${code})`, "disk");
    }
    throw new DownloadError((error as Error).message, "network");
  }
};

/**
 * Downloads a beatmap set into `dir` as `<setId>.osz`, retrying network problems a couple of times.
 */
export const fetchSet = async (setId: number, dir: string, options: FetchOptions): Promise<FetchedSet> => {
  for (let i = 1; ; i++) {
    try {
      return await attempt(setId, dir, options);
    } catch (error) {
      const kind = error instanceof DownloadError ? error.kind : "network";
      if (kind !== "network" || i >= ATTEMPTS) throw error;
      options.onProgress(0);
      await sleep(1000 * 2 ** i, options.signal);
    }
  }
};
