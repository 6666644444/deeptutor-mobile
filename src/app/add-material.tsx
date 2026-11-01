import { useRef, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { router } from "expo-router";
import { File } from "expo-file-system";
import { ownTemporaryFile } from "../lib/temporary-files";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../lib/auth";
import { Button, Heading, Page, Section, openModule, s } from "../ui";

export default function AddMaterial() {
  const { api, user } = useAuth();
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(
    null,
  );
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inFlight = useRef(false);

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/materials");
  }

  async function chooseFile() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPicking(true);
    setMessage("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "text/plain",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const selected = result.assets[0];
      if (!/\.(pdf|docx|txt)$/i.test(selected.name)) {
        Alert.alert("暂不支持这个文件", "请选择 PDF、DOCX 或 TXT 文件。");
        return;
      }
      if ((selected.size || 0) > 25 * 1024 * 1024) {
        Alert.alert(
          "文件超过 25 MB",
          "可以进入阅读与教材，添加这份较大的资料。",
          [
            { text: "取消", style: "cancel" },
            {
              text: "阅读与教材",
              onPress: () => openModule("/learning/reading", "阅读与教材"),
            },
          ],
        );
        return;
      }
      if (!api || api.isClosed) return;
      const uri = await ownTemporaryFile(api, selected.uri, selected.name);
      setFile({ ...selected, uri });
      setSubmitted(false);
    } catch {
      setMessage("暂时无法打开文件，请重试，或先将资料下载到手机后再选择。");
    } finally {
      inFlight.current = false;
      setPicking(false);
    }
  }

  async function upload() {
    if (!file || !api || inFlight.current || submitted) return;
    inFlight.current = true;
    setUploading(true);
    setSubmitted(true);
    setMessage("正在上传和解析，请稍候…");
    const form = new FormData();
    form.append("file", new File(file.uri), file.name);
    try {
      await api.ensureSession();
      await api.request(
        "/api/reading/materials",
        { method: "POST", body: form },
        true,
        180000,
      );
      setMessage("资料已保存，返回资料页即可阅读。");
      setFile(null);
    } catch (e) {
      // A timeout does not prove the upload failed. Do not offer an automatic retry.
      setMessage(
        `${(e as Error).message} 请先返回资料页查看是否已保存，再决定是否重新添加。`,
      );
    } finally {
      inFlight.current = false;
      setUploading(false);
    }
  }

  return (
    <Page>
      <Heading title="添加学习资料" back />
      <View style={[s.card, { gap: 12 }]}>
        <Text style={s.h2}>从手机或网盘选择</Text>
        <Text style={s.muted}>
          支持 PDF、DOCX、TXT，单个文件不超过 25
          MB。选好后确认添加，才会保存到学习资料中。
        </Text>
        <Button
          title={file ? "重新选择文件" : "选择文件"}
          icon="folder-open-outline"
          onPress={() => void chooseFile()}
          busy={picking}
          disabled={uploading || submitted}
        />
        <Text style={s.muted}>
          {Platform.OS === "android"
            ? "退出文件选择：点屏幕底部的返回键；使用手势导航时，从屏幕左侧或右侧向内滑动。"
            : "退出文件选择：点击文件窗口中的「取消」。"}
        </Text>
      </View>
      {file && (
        <View style={[s.card, { gap: 12, marginTop: 16 }]}>
          <Text style={s.h2}>已选文件</Text>
          <Text style={s.text}>{file.name}</Text>
          <Text style={s.muted}>
            {file.size == null
              ? "大小由文件提供方确定"
              : `${Math.max(1, Math.ceil(file.size / 1024))} KB`}
            {" · "}保存到当前账号：{user?.username}
          </Text>
          <Button
            title={uploading ? "正在保存…" : "确认添加"}
            onPress={() => void upload()}
            busy={uploading}
            disabled={submitted}
          />
        </View>
      )}
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[s.muted, { marginTop: 16 }]}
        >
          {message}
        </Text>
      ) : null}
      <View style={{ marginTop: 16 }}>
        <Button
          title={submitted ? "返回资料" : "取消添加"}
          secondary
          onPress={leave}
        />
      </View>
      <Section title="微信、飞书或其他网盘的资料" />
      <View style={[s.card, { gap: 12 }]}>
        <Text style={s.text}>
          请先在来源 App 中把文件下载或导出为 PDF、DOCX 或 TXT，再到这里选择。当前版本尚不接收外部 App 直接分享。
        </Text>
        <Text style={s.muted}>
          如果网盘已接入手机的系统文件列表，也可以在文件选择器的位置或侧边菜单中找到它。
        </Text>
        <Text style={s.muted}>
          仅有云文档链接或提取码时，请先在来源 App
          中打开并下载。
        </Text>
      </View>
    </Page>
  );
}
