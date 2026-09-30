import { BeatmapDetails, FilterResponse } from "../models/api";
import { CreateDownloadOptions, MissingMaps, QueryOrder, SearchSummary } from "../models/ipc";
import { createDownload } from "./download/manager";
import { addCollection, getLibrary } from "./library";
import { getBeatmapDetails, getHashMap, queryBeatmaps, reportDownloadStart } from "./server";

interface StoredSearch {
  name: string;
  response: FilterResponse;
  owned: Set<number>;
  summary: SearchSummary;
  /** Hashes of difficulties each set's archive should have, by set id, when known. */
  expected?: Record<string, string[]>;
}

// A few recent searches, so result pages and downloads can refer back to them by id
const searches = new Map<string, StoredSearch>();
const MAX_STORED = 5;

export const search = async (node: unknown, name: string, limit?: number, order?: QueryOrder): Promise<SearchSummary> => {
  const [response, owned] = await Promise.all([
    queryBeatmaps(node, limit, order),
    getLibrary().then((library) => library.ownedSetIds()),
  ]);
  return storeResults(name, response, owned);
};

/** Keeps a list of maps around so it can be downloaded later, like search results. */
export const storeResults = async (
  name: string,
  response: FilterResponse,
  owned?: Set<number>,
  expected?: Record<string, string[]>,
) => {
  owned ??= await (await getLibrary()).ownedSetIds();

  let totalSize = 0;
  let newSize = 0;
  let newSets = 0;
  for (const setId of response.SetIds) {
    const size = response.SizeMap[setId] ?? 0;
    totalSize += size;
    if (!owned.has(setId)) {
      newSize += size;
      newSets++;
    }
  }

  const summary: SearchSummary = {
    id: response.Id,
    beatmaps: Math.max(response.Ids.length, response.Hashes.length),
    sets: response.SetIds.length,
    newSets,
    totalSize,
    newSize,
  };

  searches.set(response.Id, { name, response, owned, summary, expected });
  while (searches.size > MAX_STORED) searches.delete(searches.keys().next().value as string);
  return summary;
};

const getSearch = (id: string) => {
  const stored = searches.get(id);
  if (!stored) throw new Error("These results have expired, please search again");
  return stored;
};

export const getResultPage = async (id: string, page: number, pageSize: number) => {
  const stored = getSearch(id);
  const start = (page - 1) * pageSize;
  const ids = stored.response.Ids.slice(start, start + pageSize);
  const beatmaps: BeatmapDetails[] = ids.length ? await getBeatmapDetails(ids) : [];
  return {
    beatmaps,
    owned: beatmaps.filter((beatmap) => stored.owned.has(beatmap.SetId)).map((beatmap) => beatmap.SetId),
  };
};

export const downloadSearch = async (id: string, { force, collectionName }: CreateDownloadOptions) => {
  const { name, response, owned, summary, expected } = getSearch(id);
  const ids = force ? response.SetIds : response.SetIds.filter((setId) => !owned.has(setId));
  const size = force ? summary.totalSize : summary.newSize;

  if (!ids.length) {
    // Nothing to download, but the collection can still be created from maps the user has
    if (collectionName) await addCollection(collectionName, response.Hashes);
    return null;
  }

  reportDownloadStart(response.Id, summary.totalSize - size);
  return createDownload({
    name,
    metricsId: response.Id,
    ids,
    sizes: response.SizeMap,
    force,
    collectionName: collectionName || undefined,
    hashes: response.Hashes,
    expected,
  });
};

let lastMissing: { ids: number[]; sizes: Record<string, number>; expected: Record<string, string[]> } | null = null;

export const findMissingMaps = async (): Promise<MissingMaps> => {
  const library = await getLibrary();
  const [collections, owned, hashMap] = await Promise.all([
    library.readCollections(),
    library.ownedSetIds(),
    getHashMap(),
  ]);

  const hashes = new Set<string>();
  for (const collection of collections) for (const hash of collection.hashes) if (hash) hashes.add(hash);

  const sizes: Record<string, number> = {};
  const expected: Record<string, string[]> = {};
  const ids: number[] = [];
  let unavailable = 0;
  let totalSize = 0;

  for (const hash of hashes) {
    const entry = hashMap[hash];
    if (!entry) {
      unavailable++;
      continue;
    }
    const [setId, size] = entry;
    if (!setId || owned.has(setId)) continue;
    // The download has to have the version the collection wants
    (expected[setId] ??= []).push(hash);
    if (setId in sizes) continue;
    sizes[setId] = size;
    ids.push(setId);
    totalSize += size;
  }

  lastMissing = { ids, sizes, expected };
  return { collections: collections.length, beatmaps: hashes.size, unavailable, ids, totalSize };
};

export const downloadMissingMaps = async () => {
  if (!lastMissing?.ids.length) throw new Error("Check your collections first");
  const { ids, sizes, expected } = lastMissing;
  lastMissing = null;
  return createDownload({
    name: "Missing maps from collections",
    metricsId: crypto.randomUUID(),
    ids,
    sizes,
    force: false,
    expected,
  });
};
