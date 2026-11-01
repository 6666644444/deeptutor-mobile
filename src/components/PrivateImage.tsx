import { useEffect, useState } from "react";
import { Image, Text } from "react-native";
import { useAuth } from "../lib/auth";
import { temporaryBytes } from "../lib/temporary-files";
export function PrivateImage({ path }: { path: string }) {
  const { api } = useAuth();
  const [stored, setStored] = useState<{ path: string; uri: string } | null>(null);
  const uri = stored?.path === path ? stored.uri : "";
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    if (api) void api.download(path).then(bytes => {
      if (alive && !api.isClosed) setStored({ path, uri: temporaryBytes(api, bytes, "attachment.jpg") });
    }).catch(() => { if (alive) setError("附件暂时无法读取，请稍后重试。"); });
    return () => { alive = false; };
  }, [api, path]);
  if (!uri) return <Text>{error || "正在读取附件…"}</Text>;
  return <Image source={{ uri }} resizeMode="contain" style={{ width: "100%", height: 200, borderRadius: 12 }} />;
}
