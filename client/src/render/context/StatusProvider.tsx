import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Metrics } from "../../models/metrics";

interface StatusContextValue {
  online: boolean;
  loading: boolean;
  metrics: Metrics | null;
  refresh: () => Promise<void>;
}

const StatusContext = createContext<StatusContextValue | null>(null);

const POLL_INTERVAL = 60_000;

const StatusProvider = ({ children }: PropsWithChildren) => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const data = await window.electron.getMetrics();
      setMetrics(data);
      setOnline(data !== null);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh]);

  return <StatusContext.Provider value={{ online, loading, metrics, refresh }}>{children}</StatusContext.Provider>;
};

export const useStatus = () => {
  const context = useContext(StatusContext);
  if (!context) throw new Error("useStatus must be used inside StatusProvider");
  return context;
};

export default StatusProvider;
