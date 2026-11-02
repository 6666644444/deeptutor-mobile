import { useEffect } from "react";
import { Alert, AppState, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ota, useOta } from "../lib/ota";
import { C, s } from "../ui";

export function restartForUpdate() {
  Alert.alert("重新打开应用？", "新版本已下载。请先完成当前编辑，再重新打开应用。", [
    { text: "稍后", style: "cancel" }, { text: "立即重启", onPress: () => void ota.restart() },
  ]);
}
export function OtaNotice() {
  const state = useOta();
  useEffect(() => {
    void ota.check();
    const subscription = AppState.addEventListener("change", status => { if (status === "active") void ota.check(); });
    return () => subscription.remove();
  }, []);
  if (state.status !== "ready") return null;
  return <SafeAreaView edges={["top"]} style={{ backgroundColor: C.pale }}>
    <View style={{ flexDirection: "row", paddingHorizontal: 18, paddingVertical: 10, alignItems: "center", gap: 10 }}>
      <Text style={[s.muted, { flex: 1 }]}>{state.message || "新版本已下载，重新打开应用后生效。"}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="立即重启" onPress={restartForUpdate} style={{ padding: 10 }}>
        <Text style={s.link}>立即重启</Text>
      </Pressable>
    </View>
  </SafeAreaView>;
}
