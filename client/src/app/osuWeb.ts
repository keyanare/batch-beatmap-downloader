import { getJson, getText, isNotFound } from "./web";

// What we read from the osu! website. These are the same public pages and JSON routes the site loads
// for visitors who aren't logged in, the official API needs an OAuth app per user.

const OSU = "https://osu.ppy.sh";

export interface WebBeatmap {
  id: number;
  setId: number;
  checksum: string;
}

export interface WebBeatmapset {
  id: number;
  artist: string;
  title: string;
  creator: string;
  beatmaps: WebBeatmap[];
}

interface RawBeatmap {
  id: number;
  beatmapset_id: number;
  checksum?: string;
  user_id?: number;
}

interface RawBeatmapset {
  id: number;
  artist?: string;
  title?: string;
  creator?: string;
  beatmaps?: RawBeatmap[];
}

const toBeatmap = (beatmap: RawBeatmap): WebBeatmap => ({
  id: beatmap.id,
  setId: beatmap.beatmapset_id,
  checksum: beatmap.checksum ?? "",
});

const BEATMAPSET_JSON = /<script id="json-beatmapset" type="application\/json">([\s\S]*?)<\/script>/;

const parseBeatmapsetPage = (html: string): WebBeatmapset | null => {
  const match = BEATMAPSET_JSON.exec(html);
  if (!match) return null;
  const set = JSON.parse(match[1]) as RawBeatmapset;
  return {
    id: set.id,
    artist: set.artist ?? "",
    title: set.title ?? "",
    creator: set.creator ?? "",
    beatmaps: (set.beatmaps ?? []).map((beatmap) => toBeatmap({ ...beatmap, beatmapset_id: set.id })),
  };
};

const page = async (url: string) => {
  try {
    return parseBeatmapsetPage(await getText(url));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

/** A beatmap set with the checksum of every difficulty, or null if it doesn't exist (anymore). */
export const getBeatmapset = (setId: number) => page(`${OSU}/beatmapsets/${setId}`);

/** The set a beatmap belongs to. The website redirects beatmap links to their set's page. */
export const getBeatmapsetOf = (beatmapId: number) => page(`${OSU}/beatmaps/${beatmapId}`);

// Multiplayer matches

interface MatchPage {
  match: { name: string };
  events: { id: number; game?: { beatmap_id: number; beatmap?: RawBeatmap | null } }[];
  first_event_id: number;
}

const MAX_MATCH_PAGES = 50;

/** Name of a multiplayer match and the beatmaps played in it, in order. */
export const getMatch = async (matchId: number) => {
  const played = new Map<number, { beatmapId: number; setId: number }>();
  const collect = (events: MatchPage["events"]) => {
    for (const event of events) {
      const beatmap = event.game?.beatmap;
      if (beatmap) played.set(event.id, { beatmapId: beatmap.id, setId: beatmap.beatmapset_id });
    }
  };

  // The newest events come first, older ones are paged in before them
  let current = await getJson<MatchPage>(`${OSU}/community/matches/${matchId}?limit=100`);
  const name = current.match.name;
  collect(current.events);
  for (let pages = 1; pages < MAX_MATCH_PAGES && current.events.length; pages++) {
    const oldest = Math.min(...current.events.map((event) => event.id));
    if (oldest <= current.first_event_id) break;
    current = await getJson<MatchPage>(`${OSU}/community/matches/${matchId}?before=${oldest}&limit=100`);
    collect(current.events);
  }

  const beatmaps = [...played.entries()].sort(([a], [b]) => a - b).map(([, beatmap]) => beatmap);
  return { name, beatmaps };
};

// Players

export interface WebUser {
  id: number;
  username: string;
}

/** Finds a player by id or name. */
export const getUser = async (key: string) => {
  const query = /^\d+$/.test(key) ? key : `@${key}`;
  const { users } = await getJson<{ users: WebUser[] }>(`${OSU}/users/lookup?ids[]=${encodeURIComponent(query)}`);
  return users[0] ?? null;
};

export type UserMapList = "maps" | "favourites" | "best";

const PAGE_SIZE = 100;
const MAX_SETS = 2000;

const userSets = async (userId: number, type: string) => {
  const sets: RawBeatmapset[] = [];
  for (let offset = 0; offset < MAX_SETS; offset += PAGE_SIZE) {
    const batch = await getJson<RawBeatmapset[]>(
      `${OSU}/users/${userId}/beatmapsets/${type}?limit=${PAGE_SIZE}&offset=${offset}`,
    );
    sets.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return sets;
};

const setBeatmaps = (set: RawBeatmapset, onlyBy?: number) =>
  (set.beatmaps ?? [])
    .filter((beatmap) => onlyBy === undefined || beatmap.user_id === onlyBy)
    .map((beatmap) => toBeatmap({ ...beatmap, beatmapset_id: set.id }));

/**
 * maps: everything the player mapped, including guest difficulties. favourites: their favourite sets.
 * best: the maps of their top plays in `mode`.
 */
export const getUserBeatmaps = async (userId: number, list: UserMapList, mode: string): Promise<WebBeatmap[]> => {
  if (list === "best") {
    const beatmaps: WebBeatmap[] = [];
    // The website only keeps the top 200
    for (const offset of [0, 100]) {
      const scores = await getJson<{ beatmap?: RawBeatmap }[]>(
        `${OSU}/users/${userId}/scores/best?mode=${mode}&limit=100&offset=${offset}`,
      );
      for (const score of scores) if (score.beatmap) beatmaps.push(toBeatmap(score.beatmap));
      if (scores.length < 100) break;
    }
    return beatmaps;
  }

  if (list === "favourites") return (await userSets(userId, "favourite")).flatMap((set) => setBeatmaps(set));

  const beatmaps: WebBeatmap[] = [];
  for (const type of ["ranked", "loved", "pending", "graveyard"]) {
    for (const set of await userSets(userId, type)) beatmaps.push(...setBeatmaps(set));
  }
  // Other people's sets: only the difficulties this player made
  for (const set of await userSets(userId, "guest")) beatmaps.push(...setBeatmaps(set, userId));
  return beatmaps;
};
