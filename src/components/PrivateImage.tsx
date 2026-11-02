import { useEffect, useState } from "react";
import { Image, Text } from "react-native";
import { useAuth } from "../lib/auth";
import { temporaryBytes } from "../lib/temporary-files";
export function PrivateImage({ path }: { path: string }) {
  const { api } = useAuth();
  const key = `${api?.scope}:${path}`;
  const [stored, setStored] = useState<{ key: string; uri: string } | null>(
    null,
  );
  const uri = stored?.key === key ? stored.uri : "";
  const [failure, setFailure] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const error = failure?.key === key ? failure.message : "";
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    if (api)
      void Promise.resolve()
        .then(() =>
          api.download(api.contentPath(path), { signal: controller.signal }),
        )
        .then((bytes) => {
          if (alive && !api.isClosed)
            setStored({
              key,
              uri: temporaryBytes(api, bytes, "attachment.jpg"),
            });
        })
        .catch(() => {
          if (alive)
            setFailure({ key, message: "附件暂时无法读取，请稍后重试。" });
        });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [api, path, key]);
  if (error || !uri) return <Text>{error || "正在读取附件…"}</Text>;
  return (
    <Image
      source={{ uri }}
      onError={() =>
        setFailure({ key, message: "图片暂时无法显示，请返回后重新打开。" })
      }
      resizeMode="contain"
      style={{ width: "100%", height: 200, borderRadius: 12 }}
    />
  );
}
