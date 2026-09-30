import { net } from "electron";
import log from "electron-log/main";
import fs from "fs";
import path from "path";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as NodeReadableStream } from "stream/web";
import { DOWNLOAD_BASE, userAgent } from "../server";
import { beatmapHashes, repairArchive } from "./archive";

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
  /**
   * Hashes of difficulties the archive should have. The server sometimes has an old version of a set, then
   * the mirrors are tried for the current one.
   */
  expected?: string[];
  /** Try the mirrors before the server, for sets the server is known to have an old version of. */
  mirrorsFirst?: boolean;
}

interface Source {
  name: string;
  url: (setId: number) => string;
  attempts: number;
}

const SERVER: Source = { name: "the server", url: (setId) => `${DOWNLOAD_BASE}/${setId}.osz`, attempts: 3 };

// Public osu! mirrors, for sets the server doesn't have or only has an old version of
const MIRRORS: Source[] = [
  { name: "catboy.best", url: (setId) => `https://catboy.best/d/${setId}`, attempts: 1 },
  { name: "nerinyan.moe", url: (setId) => `https://api.nerinyan.moe/d/${setId}`, attempts: 1 },
  { name: "osu.direct", url: (setId) => `https://osu.direct/api/d/${setId}`, attempts: 1 },
];

export interface FetchedSet {
  file: string;
  bytes: number;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new DownloadError("Aborted", "aborted"));
    });
  });

/** Downloads `url` into `file`, returns the number of bytes. */
const attempt = async (url: string, file: string, { signal, onProgress }: FetchOptions) => {
  const partial = `${file}.part`;

  let response: Response;
  try {
    response = await net.fetch(url, {
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
    return bytes;
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

const fetchFrom = async (source: Source, setId: number, file: string, options: FetchOptions) => {
  for (let i = 1; ; i++) {
    try {
      return await attempt(source.url(setId), file, options);
    } catch (error) {
      const kind = error instanceof DownloadError ? error.kind : "network";
      if (kind !== "network" || i >= source.attempts) throw error;
      options.onProgress(0);
      await sleep(1000 * 2 ** i, options.signal);
    }
  }
};

const asDownloadError = (error: unknown) =>
  error instanceof DownloadError ? error : new DownloadError((error as Error).message, "network");

/**
 * Downloads a beatmap set into `dir` as `<setId>.osz`, retrying network problems a couple of times.
 *
 * Mirrors are only asked when the server doesn't have the set or has an older version than `expected`,
 * never just because the server is unreachable: a whole download would move over to them.
 */
export const fetchSet = async (setId: number, dir: string, options: FetchOptions): Promise<FetchedSet> => {
  const file = path.join(dir, `${setId}.osz`);
  const expected = [...new Set(options.expected?.filter(Boolean) ?? [])];
  const sources = options.mirrorsFirst ? [...MIRRORS, SERVER] : [SERVER, ...MIRRORS];

  let best: { file: string; bytes: number; matched: number } | null = null;
  let failure: DownloadError | null = null;
  // osu!stable picks up any .osz in its Songs folder, so candidates don't get that name until one is chosen
  const candidates: string[] = [];
  // Mirrors all have the current version, if one doesn't have what we want the others won't either
  let mirrorDownloaded = false;

  try {
    for (const [index, source] of sources.entries()) {
      if (source !== SERVER && mirrorDownloaded) continue;
      const candidate = `${file}.${index}.download`;
      candidates.push(candidate);

      let bytes: number;
      try {
        options.onProgress(0);
        bytes = await fetchFrom(source, setId, candidate, options);
      } catch (error) {
        const reason = asDownloadError(error);
        if (reason.kind === "aborted" || reason.kind === "disk") throw reason;
        if (!failure || reason.kind === "network") failure = reason;
        // The server being unreachable isn't a reason to go elsewhere
        if (source === SERVER && reason.kind === "network" && !options.mirrorsFirst) break;
        continue;
      }
      if (source !== SERVER) mirrorDownloaded = true;

      let matched = 0;
      if (expected.length) {
        const hashes = await beatmapHashes(candidate).catch(() => new Set<string>());
        matched = expected.filter((hash) => hashes.has(hash)).length;
      }
      if (!best || matched > best.matched) {
        if (best) await fs.promises.rm(best.file, { force: true });
        best = { file: candidate, bytes, matched };
      } else {
        await fs.promises.rm(candidate, { force: true });
      }

      if (matched === expected.length) break;
      log.info(`${source.name} has an older version of ${setId} (${matched}/${expected.length}), trying elsewhere`);
    }

    if (!best) {
      if (failure?.kind === "missing") throw new DownloadError("Neither the server nor the mirrors have this set", "missing");
      throw failure ?? new DownloadError("Not available anywhere", "missing");
    }
    if (best.matched < expected.length) log.warn(`No source has the current version of ${setId}, keeping the closest`);
    await fs.promises.rename(best.file, file);
    return { file, bytes: best.bytes };
  } finally {
    // The chosen one was renamed already
    for (const candidate of candidates) await fs.promises.rm(candidate, { force: true }).catch(() => undefined);
  }
};
