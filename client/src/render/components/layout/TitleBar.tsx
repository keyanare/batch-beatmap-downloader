import clsx from "clsx";
import React from "react";
import { isMac } from "../../util/platform";
import { Logo } from "./Logo";

/** The window's title bar. The OS draws the window controls on top of it. */
export const TitleBar = () => (
  <div className={clsx("drag flex h-10 shrink-0 items-center gap-2.5", isMac ? "pl-[84px] pr-4" : "pl-4 pr-[150px]")}>
    <Logo size={18} />
    <span className="text-[13px] font-semibold tracking-tight text-fg">Batch Beatmap Downloader</span>
  </div>
);
