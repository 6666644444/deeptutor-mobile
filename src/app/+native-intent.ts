export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    const url = new URL(path);
    if (url.protocol === "deeptutor-mobile:" && url.hostname === "share-inbox")
      return "/share-inbox";
    return path;
  } catch {
    return path.startsWith("/") ? path : "/";
  }
}
