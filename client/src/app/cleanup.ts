import { app } from "electron";
import fs from "fs";
import path from "path";

// Versions before 1.4 downloaded a separate downloader program into the user data folder.
const LEGACY_DOWNLOADERS = [
  "download-windows-amd64.exe",
  "download-windows-386.exe",
  "download-linux-amd64",
  "download-linux-386",
  "download-darwin-amd64",
  "download-darwin-386",
];

export const removeLegacyDownloader = async () => {
  const folder = app.getPath("userData");
  await Promise.all(
    LEGACY_DOWNLOADERS.map((name) => fs.promises.rm(path.join(folder, name), { force: true }).catch(() => undefined)),
  );
};
