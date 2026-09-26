// Types for the Batch Beatmap Downloader server API.

export interface FilterResponse {
  Id: string;
  Ids: number[];
  SetIds: number[];
  Hashes: string[];
  SizeMap: Record<string, number>;
}

export interface BeatmapDetails {
  Title: string;
  Artist: string;
  Creator: string;
  Version: string;
  Hp: number;
  Cs: number;
  Od: number;
  Ar: number;
  Hash: string;
  Genre: string;
  ApprovedDate: number;
  Approved: string;
  Bpm: number;
  Id: number;
  SetId: number;
  Stars: number;
  FavouriteCount: number;
  HitLength: number;
  Language: string;
  MaxCombo: number;
  Mode: string;
  TotalLength: number;
  Tags: string;
  Source: string;
  LastUpdate: number;
  PassCount: number;
  PlayCount: number;
}

/** md5 hash of a beatmap -> [set id, set size in bytes] */
export type BeatmapHashMap = Record<string, [number, number]>;

export interface DownloadStartMetric {
  Id: string;
  Client: string;
  SizeRemoved: number;
}

export interface DownloadUpdateMetric {
  Id: string;
  Client: string;
  Type: "pause" | "resume" | "delete";
}

export interface BeatmapDownloadMetric {
  Id: string;
  Client: string;
  SetId: string;
  Time: number;
}
