import clsx from "clsx";
import React from "react";
import { Logo } from "./Logo";

export const isMac = navigator.userAgent.includes("Macintosh");

/** The window's title bar. The OS draws the window controls on top of it. */
export const TitleBar = () => (
  <div className={clsx("drag flex h-10 shrink-0 items-center gap-2.5", isMac ? "pl-[84px]" : "pl-4", "pr-[150px]")}>
    <Logo size={18} />
    <span className="text-[13px] font-semibold tracking-tight text-fg">Batch Beatmap Downloader</span>
  </div>
);
