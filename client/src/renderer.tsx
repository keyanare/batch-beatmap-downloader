import "@fontsource-variable/inter";
import "rc-slider/assets/index.css";
import "./render/index.css";

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./render/App";
import DownloadsProvider from "./render/context/DownloadProvider";
import LibraryProvider from "./render/context/LibraryProvider";
import SettingsProvider from "./render/context/SettingsProvider";
import StatusProvider from "./render/context/StatusProvider";

const root = createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <StatusProvider>
      <SettingsProvider>
        <LibraryProvider>
          <DownloadsProvider>
            <App />
          </DownloadsProvider>
        </LibraryProvider>
      </SettingsProvider>
    </StatusProvider>
  </React.StrictMode>,
);
