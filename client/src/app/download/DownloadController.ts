import log from "electron-log/main";
import { DownloadInfo, DownloadState } from "../../models/ipc";
import { emitError } from "../events";
import { getLibrary } from "../library";
import { onSetDownloaded as onMapUpdateDownloaded } from "../mapUpdates";
import { Library } from "../library/types";
import { ping, reportBeatmapDownload, reportDownloadUpdate } from "../server";
import { getSettings } from "../store";
import { DownloadError, fetchSet } from "./fetchSet";

/** What gets saved to disk. Compatible with the format older versions used. */
export interface PersistedDownload {
  id: string;
  name?: string;
  createdAt?: number;
  metricsId?: string;
  collectionName?: string;
  all: number[];
  completed: number[];
  failed: number[];
  skipped: number[];
  totalSize: number;
  totalProgress: number;
  force: boolean;
  /** Size of each set in bytes, when known. */
  sizes?: Record<string, number>;
  /** Hashes of difficulties each set's archive should have, by set id. */
  expected?: Record<string, string[]>;
  /** Get the sets from the mirrors first, the server is known to have old versions of them. */
  mirrorsFirst?: boolean;
}

export interface DownloadHooks {
  onChange(controller: DownloadController, important: boolean): void;
}

const SPEED_WINDOW = 5000;
const SERVER_RETRY_INTERVAL = 10000;

export class DownloadController {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly metricsId: string;
  readonly force: boolean;
  readonly collectionName?: string;

  private readonly all: number[];
  private readonly completed: number[];
  private readonly failed: number[];
  private readonly skipped: number[];
  private readonly sizes: Record<string, number>;
  private readonly expected: Record<string, string[]>;
  private readonly mirrorsFirst: boolean;
  private totalSize: number;
  private totalProgress: number;

  private state: DownloadState = "paused";
  private error?: string;

  // Every run gets a generation, so workers of a previous run know to stop.
  private generation = 0;
  private running: Promise<void> | null = null;
  private queue: number[] = [];
  private readonly active = new Map<number, AbortController>();
  private readonly inFlight = new Map<number, number>();
  private samples: { time: number; bytes: number }[] = [];
  private resumedAt = 0;
  private networkFailures = 0;
  private serverTimer: NodeJS.Timeout | null = null;

  constructor(data: PersistedDownload, private readonly hooks: DownloadHooks) {
    this.id = data.id;
    this.name = data.name || "Beatmap download";
    this.createdAt = data.createdAt ?? Date.now();
    this.metricsId = data.metricsId ?? data.id;
    this.force = data.force;
    this.collectionName = data.collectionName;
    this.all = [...data.all];
    this.completed = [...data.completed];
    this.failed = [...data.failed];
    this.skipped = [...data.skipped];
    this.sizes = { ...(data.sizes ?? {}) };
    this.expected = data.expected ?? {};
    this.mirrorsFirst = data.mirrorsFirst ?? false;
    this.totalSize = data.totalSize;
    this.totalProgress = data.totalProgress;
    if (this.remaining === 0) this.state = "finished";
  }

  get remaining() {
    return Math.max(0, this.all.length - this.completed.length - this.failed.length - this.skipped.length);
  }

  get isFinished() {
    return this.state === "finished";
  }

  /** Set ids this download still has to download. */
  pendingIds() {
    const done = new Set([...this.completed, ...this.failed, ...this.skipped]);
    return this.all.filter((id) => !done.has(id));
  }

  toPersisted(): PersistedDownload {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      metricsId: this.metricsId,
      collectionName: this.collectionName,
      all: this.all,
      completed: this.completed,
      failed: this.failed,
      skipped: this.skipped,
      totalSize: this.totalSize,
      totalProgress: this.totalProgress,
      force: this.force,
      sizes: this.sizes,
      expected: this.expected,
      mirrorsFirst: this.mirrorsFirst,
    };
  }

  info(): DownloadInfo {
    let inFlight = 0;
    for (const bytes of this.inFlight.values()) inFlight += bytes;

    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      state: this.state,
      error: this.error,
      force: this.force,
      collectionName: this.collectionName,
      total: this.all.length,
      completed: this.completed.length,
      failed: this.failed.length,
      skipped: this.skipped.length,
      totalBytes: Math.max(this.totalSize, this.totalProgress + inFlight),
      downloadedBytes: this.totalProgress + inFlight,
      speed: this.state === "running" ? this.speed() : 0,
    };
  }

  private changed(important = false) {
    this.hooks.onChange(this, important);
  }

  private addSample(bytes: number) {
    const now = Date.now();
    // Samples are grouped into 100ms buckets, progress callbacks come in for every network chunk
    const last = this.samples[this.samples.length - 1];
    if (last && now - last.time < 100) last.bytes += bytes;
    else this.samples.push({ time: now, bytes });
    while (this.samples.length && now - this.samples[0].time > SPEED_WINDOW) this.samples.shift();
  }

  private speed() {
    const now = Date.now();
    let total = 0;
    for (const sample of this.samples) if (now - sample.time <= SPEED_WINDOW) total += sample.bytes;
    const window = Math.min(SPEED_WINDOW, Math.max(1000, now - this.resumedAt));
    return (total / window) * 1000;
  }

  /** Whether the download should carry on by itself the next time the app starts. */
  get shouldResumeOnStart() {
    return this.state === "running" || this.state === "waiting";
  }

  async resume() {
    if (this.state === "running" || this.state === "finished") return;
    this.clearServerTimer();

    const generation = ++this.generation;
    this.state = "running";
    this.error = undefined;
    this.changed(true);

    // Let a previous run finish cleaning up before starting over
    if (this.running) await this.running;
    if (generation !== this.generation || this.state !== "running") return;

    reportDownloadUpdate(this.metricsId, "resume");
    this.running = this.run(generation).finally(() => {
      if (this.generation === generation) this.running = null;
    });
  }

  pause(error?: string, notifyServer = true) {
    if (this.state !== "running" && this.state !== "waiting") return;
    this.clearServerTimer();
    this.generation++;
    this.state = "paused";
    this.error = error;
    for (const controller of this.active.values()) controller.abort();
    if (notifyServer) reportDownloadUpdate(this.metricsId, "pause");
    this.changed(true);
  }

  /** Stops everything, for when the download is deleted or the app is closing. */
  async stop() {
    this.pause(undefined, false);
    if (this.running) await this.running;
  }

  retryFailed() {
    if (!this.failed.length) return;
    for (const id of this.failed) this.totalSize += this.sizes[id] ?? 0;
    this.failed.length = 0;
    // Restart so the retried sets end up in the queue
    if (this.state === "running" || this.state === "waiting") this.pause(undefined, false);
    if (this.state === "finished") this.state = "paused";
    this.changed(true);
    this.resume();
  }

  private isCurrent(generation: number) {
    return this.generation === generation && this.state === "running";
  }

  private async run(generation: number) {
    let library: Library;
    let dir: string;
    let owned: Set<number>;

    try {
      library = await getLibrary();
      const problem = await library.validate();
      if (problem) throw new Error(problem);
      dir = await library.downloadDir();
      owned = this.force ? new Set() : await library.ownedSetIds();
    } catch (error) {
      if (this.isCurrent(generation)) this.pause((error as Error).message);
      return;
    }
    if (!this.isCurrent(generation)) return;

    this.queue = [];
    for (const id of this.pendingIds()) {
      if (owned.has(id)) {
        this.skipped.push(id);
        this.totalSize -= this.sizes[id] ?? 0;
      } else {
        this.queue.push(id);
      }
    }

    this.samples = [];
    this.resumedAt = Date.now();
    this.networkFailures = 0;
    this.changed(true);

    const concurrency = (await getSettings()).maxConcurrentDownloads;
    const workers = Array.from({ length: concurrency }, () => this.worker(generation, dir, library, concurrency));
    await Promise.all(workers);

    if (!this.isCurrent(generation) || this.remaining > 0) return;

    this.state = "finished";
    this.totalSize = this.totalProgress;
    reportDownloadUpdate(this.metricsId, "delete");
    this.changed(true);

    try {
      await library.onDownloadsFinished();
    } catch (error) {
      emitError((error as Error).message);
    }
  }

  private async worker(generation: number, dir: string, library: Library, concurrency: number) {
    while (this.isCurrent(generation)) {
      const setId = this.queue.shift();
      if (setId === undefined) return;
      await this.download(generation, setId, dir, library, concurrency);
    }
  }

  private async download(generation: number, setId: number, dir: string, library: Library, concurrency: number) {
    const controller = new AbortController();
    this.active.set(setId, controller);
    const started = Date.now();

    try {
      const { file, bytes } = await fetchSet(setId, dir, {
        signal: controller.signal,
        expected: this.expected[setId],
        mirrorsFirst: this.mirrorsFirst,
        onProgress: (received) => {
          const previous = this.inFlight.get(setId) ?? 0;
          this.inFlight.set(setId, received);
          if (received > previous) this.addSample(received - previous);
          this.changed();
        },
      });

      if (this.generation !== generation) return;
      this.completed.push(setId);
      this.totalProgress += bytes;
      this.networkFailures = 0;
      library.onSetDownloaded(file);
      onMapUpdateDownloaded(setId).catch((error: Error) => log.error(`Replacing the old version of ${setId} failed`, error));
      reportBeatmapDownload(this.metricsId, setId, (Date.now() - started) / Math.max(concurrency, 1));
    } catch (error) {
      if (this.generation !== generation) return;
      const kind = error instanceof DownloadError ? error.kind : "network";
      const message = (error as Error).message;

      if (kind === "aborted") return;

      if (kind === "disk") {
        this.pause(message);
        return;
      }

      if (kind === "network" && ++this.networkFailures >= 3 && !(await ping())) {
        this.waitForServer();
        return;
      }

      log.warn(`Beatmap set ${setId} failed: ${message}`);
      this.failed.push(setId);
      this.totalSize -= this.sizes[setId] ?? 0;
    } finally {
      this.active.delete(setId);
      this.inFlight.delete(setId);
      this.changed(true);
    }
  }

  /** Pauses while the download server can't be reached, and carries on once it's back. */
  private waitForServer() {
    if (this.state !== "running") return;
    this.generation++;
    this.state = "waiting";
    this.error = "Can't reach the download server. Retrying automatically...";
    for (const controller of this.active.values()) controller.abort();
    this.changed(true);

    this.serverTimer = setInterval(() => {
      ping().then((online) => {
        if (!online || this.state !== "waiting") return;
        this.clearServerTimer();
        this.state = "paused";
        this.resume();
      });
    }, SERVER_RETRY_INTERVAL);
  }

  private clearServerTimer() {
    if (this.serverTimer) clearInterval(this.serverTimer);
    this.serverTimer = null;
  }
}
