const agent = navigator.userAgent;

export const isMac = agent.includes("Macintosh");
export const isWindows = agent.includes("Windows");
export const isLinux = !isMac && !isWindows;

/** What the osu!lazer executable is called on this platform, for labels. */
export const lazerExecutableName = isWindows ? "osu!.exe" : isMac ? "osu!.app" : "the osu! AppImage or launcher";
