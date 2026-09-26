import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from "react";
import { LibraryStatus } from "../../models/ipc";

interface LibraryContextValue {
  library: LibraryStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

const LibraryProvider = ({ children }: PropsWithChildren) => {
  const [library, setLibrary] = useState<LibraryStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setLibrary(await window.electron.getLibrary());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return window.electron.onLibrary((status) => {
      setLibrary(status);
      setLoading(false);
    });
  }, [refresh]);

  return <LibraryContext.Provider value={{ library, loading, refresh }}>{children}</LibraryContext.Provider>;
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) throw new Error("useLibrary must be used inside LibraryProvider");
  return context;
};

export default LibraryProvider;
