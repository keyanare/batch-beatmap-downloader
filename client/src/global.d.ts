import type { ElectronBridge } from "./bridges/main";

declare global {
  interface Window {
    electron: ElectronBridge;
  }
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.svg" {
  const src: string;
  export default src;
}
