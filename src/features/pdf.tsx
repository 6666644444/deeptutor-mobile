import { useEffect, useState } from "react";
import { Text, View, type ViewProps } from "react-native";
import { requireNativeViewManager } from "expo-modules-core";
import { File } from "expo-file-system";
import { temporaryBytes } from "../lib/temporary-files";
import { useAuth } from "../lib/auth";
import { Failure, Loading, s } from "../ui";
type Props = ViewProps & {
  uri: string;
  page: number;
  onDocumentState: (event: {
    nativeEvent: { pages?: number; error?: string };
  }) => void;
};
const NativeDocument = requireNativeViewManager<Props>("LearningDocument");
export function Pdf({
  materialId,
  page,
}: {
  materialId: string;
  page: number;
}) {
  const { api } = useAuth();
  const [uri, setUri] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    let file: File | undefined;
    if (api)
      void (async () => {
        try {
          await api.ensureSession();
          const bytes = await api.download(
            `/api/reading/materials/${encodeURIComponent(materialId)}/raw`, {}, 60000, 50 * 1024 * 1024,
          );
          if (!alive) return;
          file = new File(temporaryBytes(api, bytes, "reader.pdf"));
          setUri(file.uri);
        } catch (e) {
          if (alive) setError((e as Error).message);
        }
      })();
    return () => {
      alive = false;
      if (file?.exists) file.delete();
    };
  }, [api, materialId, retry]);
  return (
    <View>
      {error ? (
        <Failure
          message={error}
          retry={() => {
            setUri("");
            setError("");
            setRetry((v) => v + 1);
          }}
        />
      ) : uri ? (
        <NativeDocument
          uri={uri}
          page={page}
          style={{ height: 520, width: "100%", backgroundColor: "white" }}
          onDocumentState={(e) => {
            if (e.nativeEvent.error) setError(e.nativeEvent.error);
          }}
        />
      ) : (
        <Loading />
      )}
      <Text style={s.muted}>双指缩放查看教材原页</Text>
    </View>
  );
}
