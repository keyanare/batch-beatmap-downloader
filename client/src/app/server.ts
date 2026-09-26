import { app, net } from "electron";
import log from "electron-log/main";
import {
  BeatmapDetails,
  BeatmapDownloadMetric,
  BeatmapHashMap,
  DownloadStartMetric,
  DownloadUpdateMetric,
  FilterResponse,
} from "../models/api";
import { QueryOrder } from "../models/ipc";
import { Metrics } from "../models/metrics";
import { getValue, setValue } from "./store";

export const SERVER = "https://v2.nzbasic.com";
export const DOWNLOAD_BASE = "https://direct.nzbasic.com";

export const userAgent = () => `BatchBeatmapDownloader/${app.getVersion()}`;

export class ServerError extends Error {}

const send = async (url: string, body?: unknown) => {
  let response: Response;
  try {
    response = await net.fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", "User-Agent": userAgent() },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    throw new ServerError(`Couldn't reach the server (${(error as Error).message})`);
  }

  if (!response.ok) {
    // The server answers with plain text explaining what went wrong
    const text = (await response.text().catch(() => "")).trim();
    throw new ServerError(text && text.length < 300 ? text : `Server error (${response.status})`);
  }

  return response;
};

const request = async <T>(url: string, body?: unknown): Promise<T> => (await (await send(url, body)).json()) as T;

let clientId: string | null = null;

const getClientId = async () => {
  if (clientId) return clientId;
  clientId = (await getValue<string>("clientId")) ?? null;
  if (!clientId) {
    clientId = crypto.randomUUID();
    await setValue("clientId", clientId);
  }
  return clientId;
};

export const ping = async () => {
  try {
    const response = await net.fetch(`${SERVER}/api`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
};

export const queryBeatmaps = async (node: unknown, limit?: number, order?: QueryOrder) =>
  request<FilterResponse>(`${SERVER}/v2/filter`, {
    node,
    limit,
    by: order?.by,
    direction: order?.direction,
    clientId: await getClientId(),
  });

export const getBeatmapDetails = (ids: number[]) => request<BeatmapDetails[]>(`${SERVER}/beatmapDetails`, ids);

let hashMap: { fetched: number; data: BeatmapHashMap } | null = null;

export const getHashMap = async () => {
  // Roughly the whole database, only refetch it every now and then
  if (!hashMap || Date.now() - hashMap.fetched > 30 * 60 * 1000) {
    hashMap = { fetched: Date.now(), data: await request<BeatmapHashMap>(`${SERVER}/v2/hashMap`) };
  }
  return hashMap.data;
};

export const getMetrics = async () => {
  try {
    return await request<Metrics>(`${SERVER}/v2/metrics`);
  } catch {
    return null;
  }
};

// Anonymous usage metrics shown on the status page. Failures never affect downloads.

const report = (path: string, body: unknown) => {
  send(`${SERVER}${path}`, body)
    .then((response) => response.arrayBuffer())
    .catch((error: Error) => log.debug(`Metric ${path} failed: ${error.message}`));
};

export const reportDownloadStart = async (id: string, sizeRemoved: number) =>
  report("/v2/metrics/download/start", { Id: id, Client: await getClientId(), SizeRemoved: sizeRemoved } satisfies DownloadStartMetric);

export const reportDownloadUpdate = async (id: string, type: DownloadUpdateMetric["Type"]) =>
  report("/v2/metrics/download/update", { Id: id, Client: await getClientId(), Type: type } satisfies DownloadUpdateMetric);

export const reportBeatmapDownload = async (id: string, setId: number, time: number) =>
  report("/v2/metrics/download/beatmap", {
    Id: id,
    Client: await getClientId(),
    SetId: setId.toString(),
    Time: time,
  } satisfies BeatmapDownloadMetric);
