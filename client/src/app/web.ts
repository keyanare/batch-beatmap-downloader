import { net } from "electron";
import { userAgent } from "./server";

// Requests to other people's websites (osu!, osu!collector). They're public pages and APIs that their own
// sites use, so stay polite: one request at a time per site with a small gap, and back off when asked to.

const GAP = 350;
const TIMEOUT = 20000;
const ATTEMPTS = 3;

export class WebError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const queues = new Map<string, Promise<unknown>>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs requests to the same host one after another. */
const enqueue = <T>(host: string, task: () => Promise<T>): Promise<T> => {
  const previous = queues.get(host) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(async () => {
    try {
      return await task();
    } finally {
      await sleep(GAP);
    }
  });
  queues.set(host, next);
  return next;
};

const fetchOnce = async (url: string, accept: string) => {
  let response: Response;
  try {
    response = await net.fetch(url, {
      headers: { Accept: accept, "User-Agent": userAgent() },
      signal: AbortSignal.timeout(TIMEOUT),
      cache: "no-store",
    });
  } catch (error) {
    throw new WebError(`Couldn't reach ${new URL(url).host} (${(error as Error).message})`);
  }
  if (!response.ok) {
    await response.arrayBuffer().catch(() => undefined);
    throw new WebError(`${new URL(url).host} answered ${response.status}`, response.status);
  }
  return response;
};

const retrying = async (url: string, accept: string) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchOnce(url, accept);
    } catch (error) {
      const status = (error as WebError).status;
      // Not found and the like won't change by asking again
      const retryable = status === undefined || status === 429 || status >= 500;
      if (!retryable || attempt >= ATTEMPTS) throw error;
      await sleep(status === 429 ? 5000 * attempt : 1000 * attempt);
    }
  }
};

export const getJson = <T>(url: string) =>
  enqueue(new URL(url).host, async () => (await (await retrying(url, "application/json")).json()) as T);

export const getText = (url: string) =>
  enqueue(new URL(url).host, async () => (await retrying(url, "text/html")).text());

export const isNotFound = (error: unknown) => error instanceof WebError && error.status === 404;
