import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { router, usePathname } from "expo-router";
import { useAuth } from "./auth";
import { shareInbox } from "./share-inbox";

export function ShareObserver() {
  const { user, api } = useAuth();
  const path = usePathname();
  const seen = useRef("");
  useEffect(() => {
    if (!user) {
      seen.current = "";
      return;
    }
    let active = true;
    const check = async () => {
      try {
        const pending = await shareInbox.list();
        const key = `${api?.scope}:${pending.map((b) => b.id).join(",")}`;
        if (active && pending.length && seen.current !== key) {
          seen.current = key;
          if (path !== "/share-inbox") router.push("/share-inbox");
        }
      } catch {
        /* The inbox page provides a visible retry action. */
      }
    };
    void check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [path, user, api]);
  return null;
}
