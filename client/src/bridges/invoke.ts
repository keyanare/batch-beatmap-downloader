import { ipcRenderer, IpcRendererEvent } from "electron";

// Electron wraps errors thrown in the main process as
// "Error invoking remote method 'x': Error: message", only keep the message.
const cleanError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(message.replace(/^Error invoking remote method '[^']*': (?:\w*Error: )?/, ""));
};

export const invoke = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
  try {
    return (await ipcRenderer.invoke(channel, ...args)) as T;
  } catch (error) {
    throw cleanError(error);
  }
};

/** Subscribes to an event from the main process, returns a function that unsubscribes. */
export const subscribe = <T>(channel: string, callback: (payload: T) => void) => {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
};
