import { GameClient } from "../../models/ipc";
import { Collection } from "./collectionDb";

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

  /** Folder new .osz files are downloaded to. */
  downloadDir(): Promise<string>;
  /** Downloaded files that still have to be moved/imported into the game. */
  pendingFiles(): Promise<string[]>;
  /** Moves/imports all pending files into the game. */
  processPending(): Promise<void>;
  /** Whether processPending can do its job right now. */
  canProcessPending(): Promise<boolean>;

  onSetDownloaded(file: string): void;
  onDownloadsFinished(): Promise<void>;
  /** Called every few seconds, for background work like importing into lazer once it starts. */
  tick(): Promise<void>;
}
