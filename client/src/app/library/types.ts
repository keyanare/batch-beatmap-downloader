import { GameClient } from "../../models/ipc";
import { Collection } from "./collectionDb";

/** A beatmap (difficulty) in the game's library. */
export interface LocalBeatmap {
  setId: number;
  beatmapId: number;
  md5: string;
  /** lazer: hash of the version on the website when the game last looked, "" if unknown. stable: undefined. */
  onlineMd5?: string;
  /** Edited by the player, so it mustn't be replaced by the version from the website. */
  modified: boolean;
  /** stable: the set's folder, relative to the Songs folder. */
  folder?: string;
  artist: string;
  title: string;
  creator: string;
}

/**
 * Everything that differs between osu!stable and osu!lazer: where maps live, how new
 * maps get into the game and how collections are stored.
 */
export interface Library {
  readonly client: GameClient;
  /** The configured game folder. */
  readonly root: string;

  /** Returns a description of what's wrong with the configuration, or null if it's usable. */
  validate(): Promise<string | null>;
  /** A problem that makes things work worse without stopping them, e.g. an unreadable database. */
  warning(): string | null;
  isRunning(): Promise<boolean>;

  /** Ids of beatmap sets that are already in the game, or on their way into it. */
  ownedSetIds(): Promise<Set<number>>;
  readCollections(): Promise<Collection[]>;
  /** Only called while the game is closed. Returns the number of beatmaps added. */
  writeCollection(name: string, hashes: string[]): Promise<number>;
  /**
   * Swaps beatmaps in every collection for their updated version (old hash -> new hash). Only called while the
   * game is closed. Returns how many entries changed.
   */
  replaceCollectionHashes(replacements: Map<string, string>): Promise<number>;

  /** Every beatmap in the library that came from the website. */
  localBeatmaps(): Promise<LocalBeatmap[]>;
  /** Hashes of the beatmaps the game has right now. */
  presentHashes(): Promise<Set<string>>;
  /** stable: moves the folders of sets that were just updated out of the Songs folder. */
  retireFolders?(folders: string[]): Promise<void>;

  /** Folder new .osz files are downloaded to. */
  downloadDir(): Promise<string>;
  /** Downloaded files that still have to be moved/imported into the game. */
  pendingFiles(): Promise<string[]>;
  /** Moves/imports pending files into the game. Returns how many were moved or handed over. */
  processPending(): Promise<number>;
  /** lazer: how the game is getting on with the files it was given. */
  importProgress?(): Promise<{ importing: number; failed: number }>;
  /** Whether processPending can do its job right now. */
  canProcessPending(): Promise<boolean>;

  onSetDownloaded(file: string): void;
  onDownloadsFinished(): Promise<void>;
  /** Called every few seconds, for background work like importing into lazer once it starts. */
  tick(): Promise<void>;
}
