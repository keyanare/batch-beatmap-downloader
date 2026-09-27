export interface ChangeLogItem {
  version: string;
  date: number;
  changes: {
    title: string;
    changes: string[];
  }[]
}

export const changeLog: ChangeLogItem[] = [
  {
    version: "1.5.0",
    date: 1790553600000,
    changes: [
      {
        title: "macOS and Linux",
        changes: [
          "Builds for macOS (Apple Silicon and Intel) and Linux (AppImage and .deb)",
          "Finds osu!lazer installed as an AppImage, from the AUR or Flatpak, and osu!.app on macOS",
          "Finds osu!stable running through wine (osu-winello, ~/.wine, Lutris)",
          "Copy, paste and other shortcuts work on macOS",
          "Tells you when a new version is out, since these builds can't update themselves",
        ],
      },
    ],
  },
  {
    version: "1.4.0",
    date: 1790467200000,
    changes: [
      {
        title: "osu!lazer",
        changes: [
          "Added osu!lazer support, maps are imported straight into the game",
          "Maps you already have in osu!lazer are skipped",
          "Collections can be created in osu!lazer and checked for missing maps",
          "Your osu! installs are found automatically",
        ],
      },
      {
        title: "Downloads",
        changes: [
          "New built-in downloader, no extra program is downloaded anymore",
          "Broken or missing maps are no longer saved as corrupt .osz files",
          "Failed maps are reported as failed instead of completed, and can be retried",
          "Unfinished files are cleaned up when pausing",
          "Downloads wait for the server and resume on their own when it's unreachable",
          "Live progress, speed and time left",
          "The temporary folder can be on a different drive than your Songs folder",
        ],
      },
      {
        title: "Search",
        changes: [
          "Beatmap covers, star ratings and owned maps in the results",
          "The text query understands quotes, farm=yes and more, and no longer changes 'contains' filters into exact matches",
          "Pasting a filter now updates the advanced mode editor",
          "Filters with non-English characters can be copied",
          "Collections can be created from searches where you already have every map",
        ],
      },
      {
        title: "Client",
        changes: [
          "Completely redesigned interface with light and dark themes",
          "Settings have their own page",
          "Collections are only written while osu! is closed, so they don't get lost",
          "Collection names longer than 127 bytes no longer corrupt collection.db",
          "Updated to a current version of Electron",
        ],
      },
    ],
  },
  {
    version: "1.3.0",
    date: 1669446685871,
    changes: [
      {
        title: "Server",
        changes: [
          "Added all unranked beatmaps to the database",
          "Improved performance of querying",
          "Fixed unranked map filter",
          "V2 metrics and filter API",
          "Added ranked mapper special filter",
          "Added script to fetch new beatmaps",
          "Added script to update existing beatmap data",
          "Improved security"
        ]
      },
      {
        title: "Search",
        changes: [
          "Added 'Simple Query' mode",
          "Added share filter feature",
          "Renamed farm and stream filters under 'special'",
          "Added ordering when query limit is enabled",
        ]
      },
      {
        title: "Downloads",
        changes: [
          "Added temporary download folder support",
          "Added custom download client",
          "Added support for multiple downloads",
          "Improved download time estimation",
        ]
      },
      {
        title: "Client",
        changes: [
          "Added categories to changelog",
          "Added discord and donation links",
          "Various UI improvements",
        ],
      }
    ]
  },
  {
    version: "1.2.0",
    date: 1654838371361,
    changes: [
      {
        title: "Server",
        changes: [
          "Added tournament maps from 2019-2021 to the database",
          "Moved beatmap storage to Cloudflare R2",
        ],
      },
      {
        title: "Search",
        changes: [
          "Added support for concurrent downloads",
          "Added tournament archetypes to the query selector",
        ],
      },
      {
        title: "Client",
        changes: [
          "Added changelog",
        ],
      }
    ]
  }
]

