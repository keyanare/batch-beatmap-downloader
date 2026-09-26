import { useEffect, useState } from "react";

const read = <T,>(key: string, fallback: T): T => {
  try {
    const stored = window.localStorage.getItem(key);
    return stored !== null ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** useState that survives restarts, stored in localStorage. */
export const useStickyState = <T,>(defaultValue: T, key: string): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => read(key, defaultValue));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable, not worth bothering the user about
    }
  }, [key, value]);

  return [value, setValue];
};
