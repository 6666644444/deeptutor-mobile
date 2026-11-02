import { useState } from "react";
import { Alert } from "react-native";
import { temporaryBytes } from "../lib/temporary-files";
import * as Sharing from "expo-sharing";
import { useAuth } from "../lib/auth";
import { Button } from "../ui";

export function ExportFile({
  path,
  filename,
  mime,
  body,
  title = "导出与分享",
}: {
  path: string;
  filename: string;
  mime: string;
  body?: unknown;
  title?: string;
}) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!api || busy) return;
    setBusy(true);
    try {
      await api.ensureSession();
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("当前设备暂不支持文件分享。");
      const bytes = await api.download(
        path,
        body === undefined
          ? {}
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
        120000,
      );
      // Recheck identity after downloading before exposing the native share UI.
      await api.ensureSession();
      const name = filename
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, "-")
        .slice(0, 100);
      const uri = temporaryBytes(api, bytes, name);
      await Sharing.shareAsync(uri, {
        mimeType: mime,
        dialogTitle: "保存或分享学习资料",
      });
      // Android receivers may consume the URI after the chooser returns. Keep
      // the private cache until this client is retired or the app next starts.
    } catch (e) {
      Alert.alert("未能导出", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button title={title} secondary busy={busy} onPress={() => void run()} />
  );
}
