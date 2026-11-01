import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "./auth";
import { AppState } from "react-native";
export function useResource<T>(path: string) {
  const { api } = useAuth();
  const key = `${api?.scope || ""}:${path}`;
  const [stored, setStored] = useState<{ key: string; value: T } | null>(null);
  const data = stored?.key === key ? stored.value : null;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const run = useRef(0);
  const reload = useCallback(async () => {
    const id = ++run.current;
    if (!api) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.request<T>(path);
      if (run.current === id) setStored({ key, value: result });
    } catch (e) {
      if (run.current === id) setError((e as Error).message);
    } finally {
      if (run.current === id) setLoading(false);
    }
  }, [api, path, key]);
  useFocusEffect(
    useCallback(() => {
      void reload();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") void reload();
      });
      return () => {
        subscription.remove();
        run.current++;
      };
    }, [reload]),
  );
  return { data, error, loading, reload };
}
