import { contextBridge } from "electron";
import { downloadsBridge } from "./downloads";
import { queryBridge } from "./query";
import { settingsBridge } from "./settings";
import { systemBridge } from "./system";

export const electronBridge = {
  ...systemBridge,
  ...settingsBridge,
  ...queryBridge,
  ...downloadsBridge,
};

export type ElectronBridge = typeof electronBridge;

contextBridge.exposeInMainWorld("electron", electronBridge);
