import type { Href } from "expo-router";
export function nativeDestination(path: string): Href {
  const area: Record<string, string> = {
    "/learning/reading": "reading",
    "/learning/practice": "explore",
    "/knowledge-bases": "knowledge",
    "/learning/books": "books",
    "/learning/mastery": "mastery",
    "/notebooks": "notebooks",
    "/partners": "partners",
    "/memory": "memory",
    "/calendar": "calendar",
    "/co-writer": "writing",
    "/settings/workspace": "workspaces",
    "/": "explore",
  };
  if (path.startsWith("/chat/"))
    return { pathname: "/chat/[id]", params: { id: path.slice(6) } };
  return {
    pathname: "/feature",
    params: {
      area: area[path] || "explore",
      ...(path === "/learning/practice" ? { capability: "deep_question" } : {}),
    },
  };
}
