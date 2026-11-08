import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "./auth";
import { DEFAULT_DISPLAY, normalizeDisplay, type LearningDisplay } from "./learning-display";

const Context = createContext({ value: DEFAULT_DISPLAY, error: "", loading: false, reload: async () => {}, save: async (_value: LearningDisplay) => {} });
export const useLearningDisplay = () => useContext(Context);
export function LearningDisplayProvider({ children }: { children: React.ReactNode }) {
  const { api } = useAuth();
  const [state, setState] = useState({ api, value: DEFAULT_DISPLAY, error: "", loading: false });
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const run = ++sequence.current;
    if (!api) return;
    setState(old => ({ api, value: old.api === api ? old.value : DEFAULT_DISPLAY, error: "", loading: true }));
    try {
      const value = normalizeDisplay(await api.request<LearningDisplay>("/api/settings/display"));
      if (run === sequence.current) setState({ api, value, error: "", loading: false });
    } catch (error) {
      if (run === sequence.current) setState(old => ({ ...old, error: (error as Error).message, loading: false }));
    }
  }, [api]);
  useEffect(() => {
    void reload();
    const cancel = () => { ++sequence.current; };
    const sub = AppState.addEventListener("change", status => { if (status === "active") void reload(); });
    return () => { cancel(); sub.remove(); };
  }, [reload]);
  async function save(value: LearningDisplay) {
    if (!api) throw new Error("请先登录。");
    ++sequence.current;
    // Patch only typography. Do not overwrite theme, language or other clients' settings.
    await api.json("/api/settings/ui", normalizeDisplay(value), "PUT");
    api.assertOpen();
    setState({ api, value: normalizeDisplay(value), error: "", loading: false });
  }
  return <Context.Provider value={{ ...(state.api === api ? state : { value: DEFAULT_DISPLAY, error: "", loading: false }), reload, save }}>{children}</Context.Provider>;
}
