import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const run = (file: string, args: string[]) =>
  new Promise<string>((resolve) => {
    execFile(file, args, { windowsHide: true, timeout: 10000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) =>
      resolve(error ? "" : stdout),
    );
  });

/** Name of the IPC pipe osu!lazer listens on (osu-framework prefixes it). */
export const LAZER_PIPE = "osu-framework-osu-lazer";

const WINDOWS_PIPE_DIR = String.raw`\\.\pipe\ `.trim();

export const lazerPipePath = () =>
  process.platform === "win32"
    ? WINDOWS_PIPE_DIR + LAZER_PIPE
    : // .NET implements named pipes as unix sockets in the temp directory
      path.join(process.env.TMPDIR || "/tmp", `CoreFxPipe_${LAZER_PIPE}`);

/**
 * Whether osu!lazer is running, based on its IPC pipe existing.
 *
 * The pipe must never be opened just to check it: osu-framework's pipe server
 * gets stuck if a client connects without sending a message. On Windows listing
 * the pipe namespace is safe, while fs.exists/stat would connect to the pipe.
 */
export const isLazerRunning = async () => {
  try {
    if (process.platform === "win32") {
      const pipes = await fs.promises.readdir(WINDOWS_PIPE_DIR);
      return pipes.includes(LAZER_PIPE);
    }
    const stat = await fs.promises.lstat(lazerPipePath());
    return stat.isSocket();
  } catch {
    return false;
  }
};

const sameFolder = (a: string, b: string) =>
  path.resolve(a).replace(/[\\/]+$/, "").toLowerCase() === path.resolve(b).replace(/[\\/]+$/, "").toLowerCase();

// Executable paths of osu!.exe processes we've already looked up, by pid
const executablePaths = new Map<string, string | null>();

const lookupExecutablePaths = async (pids: string[]) => {
  const output = await run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Get-CimInstance Win32_Process -Filter "Name='osu!.exe'" | ForEach-Object { "$($_.ProcessId)|$($_.ExecutablePath)" }`,
  ]);
  for (const line of output.split(/\r?\n/)) {
    const [pid, exe] = line.trim().split("|");
    if (pid) executablePaths.set(pid, exe || null);
  }
  for (const pid of pids) if (!executablePaths.has(pid)) executablePaths.set(pid, null);
};

/**
 * Whether the osu!stable install in `stableFolder` is running. Stable rewrites collection.db when it
 * closes, so collections must not be written while it's open.
 */
export const isStableRunning = async (stableFolder: string) => {
  if (process.platform === "win32") {
    const tasks = await run("tasklist", ["/FI", "IMAGENAME eq osu!.exe", "/FO", "CSV", "/NH"]);
    const pids = [...tasks.matchAll(/^"osu!\.exe","(\d+)"/gim)].map((match) => match[1]);
    if (!pids.length) return false;

    // osu!lazer uses the same executable name, so compare install folders
    if (pids.some((pid) => !executablePaths.has(pid))) await lookupExecutablePaths(pids);
    return pids.some((pid) => {
      const exe = executablePaths.get(pid);
      // Unknown path (e.g. powershell unavailable): assume the worst
      return !exe || sameFolder(path.dirname(exe), stableFolder);
    });
  }

  // stable runs through wine elsewhere
  const output = await run("ps", ["-A", "-o", "args="]);
  return output.split(os.EOL).some((line) => /osu!\.exe/i.test(line) && !/osulazer/i.test(line));
};
