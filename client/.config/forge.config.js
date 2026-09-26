/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
require("dotenv").config();

const assets = path.join(__dirname, "..", "src", "render", "assets");

// CSP for the renderer while developing. Production builds get the same policy (minus unsafe-eval) from a meta
// tag in src/render/index.html, keep them in sync. Everything the UI needs is bundled, network access goes
// through the main process.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://assets.ppy.sh",
  "font-src 'self' data:",
  "connect-src 'self'",
].join("; ");

module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.join(assets, "bbd"),
  },
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: { owner: "nzbasic", name: "batch-beatmap-downloader" },
        authToken: process.env.GITHUB_TOKEN,
        draft: true,
      },
    },
  ],
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        // Forge 7 would turn this into batch_beatmap_downloader, but installs of older versions use the
        // name with hyphens. Changing it would install side by side instead of updating them.
        name: "batch-beatmap-downloader",
        setupExe: "BBDWindowsSetup.exe",
        setupIcon: path.join(assets, "bbd.ico"),
        iconUrl:
          "https://raw.githubusercontent.com/nzbasic/batch-beatmap-downloader/0d3d2a2f6754e0ba95f8470e71b82c579e0c5ee2/client/src/bbd.ico",
        authors: "nzbasic",
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-dmg",
      config: {
        icon: path.join(assets, "bbd.png"),
        overwrite: true,
        name: "Batch Beatmap Downloader",
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: { icon: path.join(assets, "bbd.png") },
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    {
      name: "@electron-forge/plugin-webpack",
      config: {
        mainConfig: "./.config/webpack.main.config.js",
        devContentSecurityPolicy: contentSecurityPolicy.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'"),
        renderer: {
          config: "./.config/webpack.renderer.config.js",
          entryPoints: [
            {
              html: "./src/render/index.html",
              js: "./src/renderer.tsx",
              name: "main_window",
              preload: {
                js: "./src/preload.ts",
              },
            },
          ],
        },
      },
    },
  ],
};
