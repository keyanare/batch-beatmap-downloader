import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { AppSettings, DetectedPaths } from "../../models/ipc";

interface SettingsContextValue {
  settings: AppSettings | null;
  detected: DetectedPaths | null;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  detect: () => Promise<DetectedPaths>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const applyTheme = (theme: AppSettings["theme"]) => {
  document.documentElement.classList.toggle("dark", theme === "dark");
};

const SettingsProvider = ({ children }: PropsWithChildren) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [detected, setDetected] = useState<DetectedPaths | null>(null);

  const detect = useCallback(async () => {
    const paths = await window.electron.detectPaths();
    setDetected(paths);
    return paths;
  }, []);

  useEffect(() => {
    window.electron.getSettings().then((value) => {
      applyTheme(value.theme);
      setSettings(value);
    });
    detect();
  }, [detect]);

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    if (patch.theme) applyTheme(patch.theme);
    // Optimistic, so toggles feel instant
    setSettings((current) => (current ? { ...current, ...patch } : current));
    try {
      setSettings(await window.electron.updateSettings(patch));
    } catch (error) {
      toast.error((error as Error).message);
      setSettings(await window.electron.getSettings());
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, detected, update, detect }}>{children}</SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider");
  return context;
};

export default SettingsProvider;
