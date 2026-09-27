import { spawn } from "child_process";
import net from "net";
import path from "path";
import log from "electron-log/main";
import { isLazerRunning, lazerPipePath } from "../processes";

// Two ways of handing .osz files to osu!lazer:
//
// 1. Starting osu!.exe with the files as arguments. This is what happens when a user
//    double clicks an .osz file: a new process forwards the paths to the running game
//    over IPC and exits, or starts the game and imports them if it isn't running.
// 2. Talking to the game's IPC pipe directly, for when we don't know where osu!.exe is
//    (e.g. the Linux AppImage). The message format matches osu-framework's
//    NamedPipeIpcProvider: a little endian int32 length followed by JSON.

// Windows limits the whole command line to 32767 characters.
const MAX_COMMAND_LINE = 30000;

const chunkByLength = (files: string[]) => {
  const chunks: string[][] = [];
  let current: string[] = [];
  let length = 0;

  for (const file of files) {
    const size = file.length + 3;
    if (current.length && length + size > MAX_COMMAND_LINE) {
      chunks.push(current);
      current = [];
      length = 0;
    }
    current.push(file);
    length += size;
  }

  if (current.length) chunks.push(current);
  return chunks;
};

/**
 * Starts osu!.exe with the files. When the game is already running the new process only
 * forwards the paths and exits, so wait for that. Otherwise the new process *is* the game.
 */
const launch = (exe: string, files: string[], waitForExit: boolean) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(exe, files, {
      cwd: path.dirname(exe),
      detached: true,
      stdio: "ignore",
    });

    let settled = false;
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      child.unref();
      if (error) reject(error);
      else resolve();
    };

    child.once("error", (error) => settle(error));
    if (waitForExit) {
      child.once("exit", () => settle());
      setTimeout(() => settle(), 15000);
    } else {
      child.once("spawn", () => settle());
    }
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits for a freshly started game to be ready to accept imports from other processes. */
const waitForGame = async () => {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline && !(await isLazerRunning())) await sleep(1000);
  // The pipe exists before the game has finished loading and registered its import handler
  await sleep(10000);
};

/**
 * Imports files by starting osu!.exe with them as arguments. Starts the game if it isn't running.
 */
export const importWithExecutable = async (exe: string, files: string[], running: boolean) => {
  const chunks = chunkByLength(files);
  for (let i = 0; i < chunks.length; i++) {
    log.info(`Importing ${chunks[i].length} beatmaps into osu!lazer via ${exe}`);
    const gameStarting = i === 0 && !running;
    await launch(exe, chunks[i], !gameStarting);
    if (gameStarting && chunks.length > 1) await waitForGame();
  }
};

const ARCHIVE_IMPORT_MESSAGE = "osu.Game.IPC.ArchiveImportMessage, osu.Game";

const encodeImportMessage = (file: string) => {
  const json = Buffer.from(JSON.stringify({ Type: ARCHIVE_IMPORT_MESSAGE, Value: { Path: file } }), "utf8");
  const header = Buffer.alloc(4);
  header.writeInt32LE(json.length);
  // Header and body go out in a single write: the server reads the header with a single read call.
  return Buffer.concat([header, json]);
};

const sendOverPipe = (pipe: string, file: string) =>
  new Promise<void>((resolve, reject) => {
    const socket = net.connect(pipe);
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Timed out talking to osu!lazer"));
    }, 5000);

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    socket.once("connect", () => {
      socket.end(encodeImportMessage(file));
    });
    socket.once("close", () => {
      clearTimeout(timeout);
      resolve();
    });
  });

/**
 * Imports files through the running game's IPC pipe. Only call this when lazer is running.
 */
export const importWithPipe = async (files: string[]) => {
  const pipe = await lazerPipePath();
  if (!pipe) throw new Error("Couldn't find osu!lazer's IPC pipe");
  log.info(`Importing ${files.length} beatmaps into osu!lazer via IPC`);
  for (const file of files) {
    await sendOverPipe(pipe, file);
  }
};
