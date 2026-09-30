import log from "electron-log/main";
import { FilterResponse } from "../models/api";
import { LinkLookup, UserMapList } from "../models/ipc";
import { getBeatmapset, getBeatmapsetOf, getMatch, getRoom, getUser, getUserBeatmaps, WebBeatmapset } from "./osuWeb";
import { storeResults } from "./search";
import { tryBeatmapDetails, tryServerSets } from "./server";
import { getJson, isNotFound } from "./web";

// Turns pasted text (links to osu!collector, beatmaps, multiplayer matches or players) into a list of maps
// that can be downloaded and put in a collection like search results.

export interface LinkSources {
  collections: number[];
  tournaments: number[];
  matches: number[];
  rooms: number[];
  users: { key: string; mode: string }[];
  beatmapIds: number[];
  setIds: number[];
}

const MODES = ["osu", "taiko", "fruits", "mania"];

const LINK = /(?:https?:\/\/)?(?:www\.)?(?:osucollector\.com|(?:osu|old|new|lazer)\.ppy\.sh)\/[^\s"'<>()[\]]+|osu:\/\/(?:b|s|dl)\/\d+/gi;

const number = (value: string | undefined | null) => {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const parseLinks = (text: string): LinkSources => {
  const sources: LinkSources = {
    collections: [],
    tournaments: [],
    matches: [],
    rooms: [],
    users: [],
    beatmapIds: [],
    setIds: [],
  };
  const add = <T>(list: T[], value: T | null) => {
    if (value !== null && !list.includes(value)) list.push(value);
  };

  for (const [match] of text.matchAll(LINK)) {
    // Punctuation after a link in a sentence isn't part of it
    const raw = match.replace(/[.,;:!?]+$/, "");
    const direct = /^osu:\/\/(b|s|dl)\/(\d+)/i.exec(raw);
    if (direct) {
      add(direct[1].toLowerCase() === "b" ? sources.beatmapIds : sources.setIds, number(direct[2]));
      continue;
    }

    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      continue;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const [first, second, third] = parts.map((part) => decodeURIComponent(part));
    const kind = first?.toLowerCase();

    if (url.hostname.endsWith("osucollector.com")) {
      if (kind === "collections") add(sources.collections, number(second));
      else if (kind === "tournaments") add(sources.tournaments, number(second));
      continue;
    }

    if (kind === "beatmapsets") {
      // beatmapsets/123#osu/456 links a difficulty, beatmapsets/123 (or its discussion) the whole set
      const difficulty = /^#(?:osu|taiko|fruits|mania)\/(\d+)/.exec(url.hash);
      if (difficulty) add(sources.beatmapIds, number(difficulty[1]));
      else add(sources.setIds, number(second));
    } else if (kind === "beatmaps" || kind === "b") {
      add(sources.beatmapIds, number(second));
    } else if (kind === "s") {
      add(sources.setIds, number(second));
    } else if (kind === "p" && second === "beatmap") {
      if (url.searchParams.has("b")) add(sources.beatmapIds, number(url.searchParams.get("b")));
      else add(sources.setIds, number(url.searchParams.get("s")));
    } else if (kind === "multiplayer" && second?.toLowerCase() === "rooms") {
      add(sources.rooms, number(third));
    } else if ((kind === "community" && second?.toLowerCase() === "matches") || kind === "mp") {
      add(sources.matches, number(kind === "mp" ? second : third));
    } else if ((kind === "users" || kind === "u") && second) {
      const mode = third && MODES.includes(third.toLowerCase()) ? third.toLowerCase() : "osu";
      if (!sources.users.some((user) => user.key.toLowerCase() === second.toLowerCase())) {
        sources.users.push({ key: second, mode });
      }
    }
  }
  return sources;
};

export const countSources = (sources: LinkSources) =>
  sources.collections.length +
  sources.tournaments.length +
  sources.matches.length +
  sources.rooms.length +
  sources.users.length +
  sources.beatmapIds.length +
  sources.setIds.length;

// osu!collector

const COLLECTOR = "https://osucollector.com/api";

interface CollectorCollection {
  name: string;
  uploader?: { username?: string };
  beatmapsets: { id: number; beatmaps: { id: number; checksum: string }[] }[];
}

interface CollectorTournament {
  name: string;
  rounds: { mods: { maps: { id: number; checksum: string; beatmapset: { id: number } }[] }[] }[];
}

const fromCollector = async <T>(path: string, what: string) => {
  try {
    return await getJson<T>(`${COLLECTOR}/${path}`);
  } catch (error) {
    if (isNotFound(error)) throw new Error(`That osu!collector ${what} doesn't exist`);
    throw error;
  }
};

// Resolving

interface Found {
  setId?: number;
  beatmapId?: number;
  hash?: string;
}

const USER_LISTS: Record<UserMapList, string> = {
  maps: "maps",
  favourites: "favourites",
  best: "top plays",
};

// Every set page is a request to the osu! website, don't make hundreds of them for one paste
const MAX_PAGES = 300;

export const lookupLinks = async (text: string, userList: UserMapList): Promise<LinkLookup> => {
  const sources = parseLinks(text);
  const total = countSources(sources);
  if (!total) throw new Error("There are no osu! or osu!collector links in that");

  const titles: string[] = [];
  const beatmaps: Found[] = [];
  const wholeSets = new Set<number>(sources.setIds);

  for (const id of sources.collections) {
    const collection = await fromCollector<CollectorCollection>(`collections/${id}`, "collection");
    titles.push(collection.name);
    for (const set of collection.beatmapsets) {
      for (const beatmap of set.beatmaps) beatmaps.push({ setId: set.id, beatmapId: beatmap.id, hash: beatmap.checksum });
    }
  }

  for (const id of sources.tournaments) {
    const tournament = await fromCollector<CollectorTournament>(`tournaments/${id}`, "tournament");
    titles.push(tournament.name);
    for (const round of tournament.rounds) {
      for (const mod of round.mods) {
        for (const map of mod.maps) beatmaps.push({ setId: map.beatmapset.id, beatmapId: map.id, hash: map.checksum });
      }
    }
  }

  for (const id of sources.matches) {
    try {
      const match = await getMatch(id);
      titles.push(match.name);
      beatmaps.push(...match.beatmaps);
    } catch (error) {
      if (isNotFound(error)) throw new Error(`Multiplayer match ${id} doesn't exist`);
      throw error;
    }
  }

  for (const id of sources.rooms) {
    try {
      const room = await getRoom(id);
      titles.push(room.name);
      for (const beatmap of room.beatmaps) {
        beatmaps.push({ setId: beatmap.setId || undefined, beatmapId: beatmap.id, hash: beatmap.checksum || undefined });
      }
    } catch (error) {
      if (isNotFound(error)) throw new Error(`Multiplayer room ${id} doesn't exist`);
      throw error;
    }
  }

  for (const { key, mode } of sources.users) {
    const user = await getUser(key);
    if (!user) throw new Error(`There's no player called ${key}`);
    titles.push(`${user.username}'s ${USER_LISTS[userList]}`);
    for (const beatmap of await getUserBeatmaps(user.id, userList, mode)) {
      beatmaps.push({ setId: beatmap.setId, beatmapId: beatmap.id, hash: beatmap.checksum });
    }
  }

  for (const id of sources.beatmapIds) beatmaps.push({ beatmapId: id });

  // Fill in what the links didn't say: which set a beatmap is in and its hash (for the collection)
  const missing = beatmaps.filter((beatmap) => !beatmap.hash || !beatmap.setId);
  const details = await tryBeatmapDetails(missing.map((beatmap) => beatmap.beatmapId ?? 0));
  const pages = new Map<number, WebBeatmapset | null>();
  let unresolved = 0;

  const fromPage = (set: WebBeatmapset | null | undefined, beatmapId: number) =>
    set?.beatmaps.find((beatmap) => beatmap.id === beatmapId);

  for (const beatmap of missing) {
    const detail = beatmap.beatmapId ? details.get(beatmap.beatmapId) : undefined;
    if (detail) {
      beatmap.setId = detail.SetId;
      beatmap.hash = detail.Hash;
      continue;
    }
    if (!beatmap.beatmapId || pages.size >= MAX_PAGES) {
      unresolved++;
      continue;
    }

    try {
      let found = beatmap.setId ? fromPage(pages.get(beatmap.setId), beatmap.beatmapId) : undefined;
      if (!found && beatmap.setId && !pages.has(beatmap.setId)) {
        pages.set(beatmap.setId, await getBeatmapset(beatmap.setId));
        found = fromPage(pages.get(beatmap.setId), beatmap.beatmapId);
      }
      if (!found) {
        const set = await getBeatmapsetOf(beatmap.beatmapId);
        if (set) pages.set(set.id, set);
        found = fromPage(set, beatmap.beatmapId);
      }
      if (found) {
        beatmap.setId = found.setId;
        beatmap.hash = found.checksum;
      } else {
        unresolved++;
      }
    } catch (error) {
      log.warn(`Couldn't look up beatmap ${beatmap.beatmapId}: ${(error as Error).message}`);
      unresolved++;
    }
  }

  // Without the server everything comes from the mirrors
  const serverSets = await tryServerSets();
  const hashes = new Set<string>();
  const ids = new Set<number>();
  const setIds = new Set<number>();

  for (const beatmap of beatmaps) {
    if (beatmap.hash) hashes.add(beatmap.hash);
    if (beatmap.beatmapId) ids.add(beatmap.beatmapId);
    if (beatmap.setId) setIds.add(beatmap.setId);
  }

  // Whole sets go into the collection with every difficulty
  for (const setId of wholeSets) {
    setIds.add(setId);
    let setHashes = [...(serverSets.get(setId)?.hashes ?? [])];
    if (!setHashes.length && pages.size < MAX_PAGES) {
      const set = pages.get(setId) ?? (await getBeatmapset(setId).catch(() => null));
      pages.set(setId, set);
      setHashes = set?.beatmaps.map((beatmap) => beatmap.checksum) ?? [];
    }
    for (const hash of setHashes) if (hash) hashes.add(hash);
  }

  if (!setIds.size && !hashes.size) throw new Error("There are no maps behind those links");

  // Sets the server doesn't have come from the mirrors, which don't say how big they are
  const sizes: Record<string, number> = {};
  for (const setId of setIds) sizes[setId] = serverSets.get(setId)?.size ?? 0;

  const expected: Record<string, string[]> = {};
  for (const beatmap of beatmaps) {
    if (beatmap.setId && beatmap.hash) (expected[beatmap.setId] ??= []).push(beatmap.hash);
  }

  const title =
    titles.length === 0
      ? `${total} beatmap link${total === 1 ? "" : "s"}`
      : titles.length === 1
        ? titles[0]
        : `${titles[0]} and ${titles.length - 1} more`;

  const response: FilterResponse = {
    Id: crypto.randomUUID(),
    Ids: [...ids],
    SetIds: [...setIds],
    Hashes: [...hashes],
    SizeMap: sizes,
  };

  return {
    title,
    collectionName: titles.length === 1 ? titles[0] : "",
    summary: await storeResults(title, response, undefined, expected),
    notOnServer: [...setIds].filter((setId) => !serverSets.has(setId)).length,
    unresolved,
  };
};
