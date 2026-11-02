import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Platform, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { shareInbox } from "../lib/share-inbox";
import { assertShareAccount, type SharedBatch } from "../lib/share-policy";
import { useAuth } from "../lib/auth";
import { materialUpload } from "../lib/material-upload";
import { Button, Empty, Failure, Heading, Loading, Page, s } from "../ui";

export default function ShareInbox() {
  const { api, user } = useAuth();
  const [batches, setBatches] = useState<SharedBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [attempted, setAttempted] = useState(false);
  usePreventRemove(busy, () => {
    Alert.alert("资料正在保存", "请等待处理结果，再返回资料页。");
  });
  const inFlight = useRef(false);
  const current = useRef(api);
  useEffect(() => {
    current.current = api;
    return () => {
      current.current = null;
    };
  }, [api]);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBatches(await shareInbox.list());
    } catch {
      setError("暂时无法读取待接收文件，请重试。");
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void reload();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active" && !inFlight.current) void reload();
      });
      return () => subscription.remove();
    }, [reload]),
  );
  const batch = batches[0];

  async function discard() {
    if (!batch || inFlight.current) return;
    await shareInbox.remove(batch.id);
    setProgress("");
    setAttempted(false);
    await reload();
  }
  async function upload() {
    if (!batch || !api || !user || inFlight.current || attempted) return;
    const owner = api.scope;
    inFlight.current = true;
    setBusy(true);
    setAttempted(true);
    let saved = 0;
    try {
      // Verify the live session before any write, including after process restoration.
      await api.ensureSession();
      for (const file of batch.files) {
        assertShareAccount(owner, current.current?.scope);
        setProgress(
          `正在保存 ${saved + 1}/${batch.files.length}：${file.name}`,
        );
        const upload = await materialUpload(file);
        assertShareAccount(owner, current.current?.scope);
        await api.request(
          "/api/reading/materials",
          { method: "POST", ...upload },
          true,
          180000,
        );
        assertShareAccount(owner, current.current?.scope);
        saved++;
      }
      await shareInbox.remove(batch.id);
      setProgress(`已将 ${saved} 份资料保存到 ${user.username}。`);
      setBatches((values) => values.filter((v) => v.id !== batch.id));
      setAttempted(false);
    } catch (e) {
      setProgress(
        `已完成 ${saved} 份。${(e as Error).message} 请先去资料页确认结果；这里不会自动重试，避免重复保存。`,
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Page>
      <Heading title="待接收资料" back />
      <Text style={[s.muted, { marginBottom: 16 }]}>
        文件先保存在本机。核对文件和账号，确认后才上传。
      </Text>
      {!shareInbox.available ? (
        <Empty
          title="请使用独立学习 App"
          detail="当前预览环境不能接收其他 App 分享的文件。"
        />
      ) : null}
      {error ? (
        <Failure message={error} retry={() => void reload()} />
      ) : loading ? (
        <Loading />
      ) : !batch ? (
        <Empty
          title={progress ? "接收已完成" : "还没有待接收文件"}
          detail={
            Platform.OS === "ios"
              ? "在其他 App 中分享文件给 DeepTutor，接收后回到这里确认保存。"
              : "在其他 App 中选择文件，点击分享或用其他应用打开，再选择 DeepTutor 学习。"
          }
        />
      ) : (
        <View style={{ gap: 14 }}>
          <View style={[s.card, { gap: 8 }]}>
            <Text style={s.h2}>保存到当前账号</Text>
            <Text style={s.text}>{user?.username}</Text>
            <Text style={s.muted}>{api?.config.origin}</Text>
            <Text style={s.muted}>工作区：{api?.workspaceId || "默认"}</Text>
            <Text style={s.muted}>
              资料只保存到这个账号。若账号不对，请先取消，再切换账号后重新分享。
            </Text>
          </View>
          {batch.files.map((file, index) => (
            <View key={index} style={s.card}>
              <Text style={s.rowTitle}>{file.name}</Text>
              <Text style={s.muted}>{Math.ceil(file.size / 1024)} KB</Text>
            </View>
          ))}
          {batch.errors.map((message, index) => (
            <Text key={index} style={s.muted}>
              {message}
            </Text>
          ))}
          {!!batch.files.length && (
            <Button
              title={`确认保存到 ${user?.username}`}
              disabled={attempted}
              busy={busy}
              onPress={() => void upload()}
            />
          )}
          <Button
            title="取消这次接收"
            secondary
            disabled={busy}
            onPress={() =>
              Alert.alert(
                "取消接收？",
                "仅移除本机待接收文件，来源 App 和已保存的学习资料不受影响。",
                [
                  { text: "继续保留", style: "cancel" },
                  {
                    text: "取消接收",
                    onPress: () =>
                      void discard().catch(() =>
                        setError("暂时未能移除，请重试。"),
                      ),
                  },
                ],
              )
            }
          />
          {batches.length > 1 ? (
            <Text style={s.muted}>
              还有 {batches.length - 1} 批资料待处理。
            </Text>
          ) : null}
        </View>
      )}
      {progress ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[s.text, { marginTop: 18 }]}
        >
          {progress}
        </Text>
      ) : null}
      <View style={{ marginTop: 18 }}>
        <Button
          title="查看我的资料"
          secondary
          disabled={busy}
          onPress={() => router.replace("/(tabs)/materials")}
        />
      </View>
    </Page>
  );
}
