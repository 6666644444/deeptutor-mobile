import React, { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { fetch as expoFetch } from "expo/fetch";
import { SessionManager } from "./session-manager";
import { clearTemporaryFiles } from "./temporary-files";
import { shareInbox } from "./share-inbox";
const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
const manager = new SessionManager({
  get: key => SecureStore.getItemAsync(key, options),
  set: (key, value) => SecureStore.setItemAsync(key, value, options),
  remove: key => SecureStore.deleteItemAsync(key, options),
}, expoFetch as typeof fetch, () => shareInbox.clear());
export const savedCredentials = () => manager.savedCredentials();
const getSnapshot = () => manager.snapshot;
const useValue = () => {
  const state = useSyncExternalStore(manager.subscribe, getSnapshot, getSnapshot);
  return { ...state, user: state.api?.user || null,
    restore: () => state.config ? manager.connect(state.config, false) : manager.start(),
    login: (username: string, password: string) => manager.login(username, password),
    logout: () => manager.logout(),
    connect: manager.connect.bind(manager),
    editConnections: () => manager.editConnections(),
    forget: (origin: string) => manager.forget(origin),
    setWorkspace: (workspaceId: string) => manager.setWorkspace(workspaceId),
  };
};
const Context = createContext<ReturnType<typeof useValue>>(null!);
export const useAuth = () => useContext(Context);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useValue();
  useEffect(() => {
    clearTemporaryFiles();
    void manager.start();
    const retry = () => {
      const s = manager.snapshot;
      if (AppState.currentState === "active" && !s.booting && s.bootError && s.config)
        void manager.connect(s.config, false);
    };
    const interval = setInterval(retry, 10000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") retry(); });
    return () => { clearInterval(interval); subscription.remove(); manager.dispose(); };
  }, []);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
