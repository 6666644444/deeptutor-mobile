import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform, Switch, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { APP_RELEASE } from "../lib/app-release";
import { checkReleases, compareVersions, newestRelease, parseVersion, readableReleaseNotes, RELEASES_URL, type AppRelease } from "../lib/updates";
import { Button, C, Heading, Page, Section, s } from "../ui";

export default function Updates() {
  const [releases, setReleases] = useState<AppRelease[] | null>(null);
  const [preview, setPreview] = useState(!!parseVersion(APP_RELEASE)?.pre.length);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState("");
  const pending = useRef<AbortController | null>(null);
  const read = useCallback((request: AbortController) => {
    return checkReleases(request.signal).then(result => {
      if (!request.signal.aborted) { setReleases(result); setChecked(new Date().toLocaleString("zh-CN")); }
    }).catch(e => {
      if (!request.signal.aborted) setError(e instanceof Error ? e.message : "检查失败，请重试。");
    }).finally(() => { if (!request.signal.aborted) setBusy(false); });
  }, []);
  const check = () => {
    pending.current?.abort();
    const request = new AbortController();
    pending.current = request;
    setBusy(true); setError(""); setReleases(null); setChecked("");
    void read(request);
  };
  useEffect(() => {
    const request = new AbortController();
    pending.current = request;
    void read(request);
    return () => pending.current?.abort();
  }, [read]);
  const release = releases && newestRelease(releases, preview);
  const difference = release ? compareVersions(release.tag, APP_RELEASE) : null;
  const open = async (url: string) => {
    try { await Linking.openURL(url); }
    catch { Alert.alert("暂时无法打开", "请确认设备可以使用浏览器后重试。"); }
  };
  const status = difference === null ? "可用发布版本" : difference > 0 ? "发现新版本" :
    difference === 0 ? "当前版本与最新发布一致" : "当前版本高于已发布版本";
  return <Page>
    <Heading title="应用更新" sub="查看客户端的新版本" back />
    <View style={[s.card, { gap: 12 }]}>
      <Text style={s.h2}>DeepTutor 移动版</Text>
      <Text style={s.text}>当前版本：{APP_RELEASE || "未标记版本"}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle}>包含预览版</Text>
          <Text style={s.muted}>提前体验尚在完善的新功能</Text>
        </View>
        <Switch accessibilityLabel="包含预览版" value={preview} onValueChange={setPreview} trackColor={{ true: C.teal }} />
      </View>
      <Button title={busy ? "正在检查…" : "检查新版本"} busy={busy} onPress={() => void check()} />
      {!!checked && <Text style={s.muted}>检查时间：{checked}</Text>}
      {!!error && <Text accessibilityRole="alert" style={{ color: C.danger, lineHeight: 22 }}>{error}</Text>}
    </View>
    {release ? <>
      <Section title={status} />
      <View style={[s.card, { gap: 12 }]}>
        <Text style={s.h2}>{release.tag} · {release.preview ? "预览版" : "正式版"}</Text>
        <Text style={s.muted}>发布于 {new Date(release.published).toLocaleDateString("zh-CN")}</Text>
        {Platform.OS === "android" ? <Text style={s.text}>{release.hasAndroidApk
          ? "已提供 Android 安装包，可在发布页选择适合设备的版本，下载后确认安装。"
          : "此版本尚未提供 Android 安装包，暂时只能查看说明和源码。"}</Text>
          : <Text style={s.text}>iPhone 和 iPad 安装更新需由发行者提供 TestFlight 或 App Store 渠道。这里提供版本说明与源码。</Text>}
        <Button title={Platform.OS === "android" && release.hasAndroidApk && difference !== null && difference > 0
          ? "前往 GitHub 下载安装包" : "查看此版本发布页"} onPress={() => void open(release.url)} />
      </View>
      <Section title="更新说明" />
      <View style={s.card}><Text selectable style={s.text}>{readableReleaseNotes(release.notes) || "暂无更新说明。"}</Text></View>
    </> : releases ? <View style={[s.notice, { gap: 8 }]}>
      <Text style={s.text}>{preview ? "暂未发布可用版本。" : "暂未发布正式版，可开启“包含预览版”查看。"}</Text>
    </View> : null}
    <Section title="发布记录" />
    <Button title="在 GitHub 查看所有版本" secondary onPress={() => void open(RELEASES_URL)} />
    <Text style={[s.muted, { marginTop: 16 }]}>这里只检查客户端版本，不会更新学习服务器。检查版本不会上传学习资料。</Text>
  </Page>;
}
