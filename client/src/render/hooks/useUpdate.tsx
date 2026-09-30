import { useEffect, useState } from "react";
import { UpdateInfo } from "../../models/ipc";

/** A newer version of the app, if there is one, kept up to date while it downloads. */
export const useUpdate = () => {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    window.electron.getUpdate().then(setUpdate);
    return window.electron.onUpdate(setUpdate);
  }, []);

  return update;
};
