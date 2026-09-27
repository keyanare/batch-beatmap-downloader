/* eslint-disable @typescript-eslint/no-var-requires */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const assets = path.join(__dirname, "..", "src", "render", "assets");

const productName = "Batch Beatmap Downloader";
// Spaces in the executable name trip up Linux packaging and launchers
const linuxName = "batch-beatmap-downloader";

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
    // bbd.ico on Windows, bbd.icns on macOS
    icon: path.join(assets, "bbd"),
    appBundleId: "com.nzbasic.batch-beatmap-downloader",
    appCategoryType: "public.app-category.utilities",
    ...(process.platform === "linux" ? { executableName: linuxName } : {}),
  },
  hooks: {
    // There's no Apple developer certificate, so the app is signed ad hoc. Apple Silicon Macs refuse to run
    // code without any signature, and packaging invalidates the one the Electron binary comes with.
    postPackage: async (_config, { platform, outputPaths }) => {
      if (platform !== "darwin") return;
      for (const output of outputPaths) {
        const app = path.join(output, `${productName}.app`);
        if (!fs.existsSync(app)) continue;
        execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
      }
    },
  },
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: { owner: "keyanare", name: "batch-beatmap-downloader" },
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
      platforms: ["darwin", "linux"],
    },
    {
      name: "@electron-forge/maker-dmg",
      // Without a name the file is called "<app>-<version>-<arch>.dmg", so Intel and Apple Silicon builds
      // don't overwrite each other in a release
      config: {
        icon: path.join(assets, "bbd.icns"),
        overwrite: true,
      },
    },
    {
      name: "@electron-forge/maker-deb",
      platforms: ["linux"],
      config: {
        options: {
          name: linuxName,
          bin: linuxName,
          productName,
          icon: path.join(assets, "bbd.png"),
          categories: ["Game", "Utility"],
          homepage: "https://github.com/keyanare/batch-beatmap-downloader",
        },
      },
    },
    {
      name: "@reforged/maker-appimage",
      platforms: ["linux"],
      config: {
        options: {
          name: linuxName,
          bin: linuxName,
          productName,
          icon: path.join(assets, "bbd.png"),
          categories: ["Game", "Utility"],
        },
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
