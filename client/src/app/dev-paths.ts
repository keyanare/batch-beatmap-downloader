import { app } from "electron";
import path from "path";

// Development builds keep their settings and downloads apart from an installed copy of the app.
// Imported before anything else touches the user data folder.
if (!app.isPackaged) {
  app.setPath("userData", path.join(app.getPath("appData"), "Batch Beatmap Downloader (dev)"));
}
