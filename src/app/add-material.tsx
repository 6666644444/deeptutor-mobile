import { ownTemporaryFile } from "../lib/temporary-files";
import { useRef, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../lib/auth";
import { materialUpload } from "../lib/material-upload";
import { useResource } from "../lib/resources";
import { Button, Heading, Page, Section, s } from "../ui";

export default function AddMaterial() {
  const { api, user } = useAuth();
  const formats = useResource<{ extensions: string[] }>(
    "/api/reading/supported-formats",
  );
  const { workspace } = useLocalSearchParams<{ workspace?: string }>();
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
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const selected = result.assets[0];
      const ext = "." + (selected.name.split(".").pop()?.toLowerCase() || "");
      if (
        !(formats.data?.extensions || [".pdf", ".docx", ".txt"]).includes(ext)
      ) {
        Alert.alert(
          "暂不支持这个文件",
          "学习服务不支持这个文件格式，请先导出为 PDF、Word 或文本。",
        );
        return;
      }
      if ((selected.size || 0) > 25 * 1024 * 1024) {
        Alert.alert("文件超过 25 MB", "请压缩文件或分章节后添加。");
        return;
      }
      if (!api) return;
      selected.uri = await ownTemporaryFile(api, selected.uri, selected.name);
      setFile(selected);
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
    try {
      const upload = await materialUpload(file, formats.data?.extensions);
      const material = await api.request<{ material_id: string }>(
        "/api/reading/materials",
        { method: "POST", ...upload },
        true,
        180000,
      );
      if (workspace)
        await api.json(
          `/api/reading/workspaces/${encodeURIComponent(workspace)}/materials`,
          { material_id: material.material_id, make_active: true },
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
          支持服务端可解析的教材、文档和音视频，单个文件不超过 25
          MB。选好后确认添加，才会保存到学习资料中。音视频转写需服务端配置语音识别。
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
          在来源 App 中选择文件，点分享或“用其他应用打开”，选择“DeepTutor
          学习”。也可以先下载或导出为 PDF、DOCX，再到这里选择。
        </Text>
        <Text style={s.muted}>
          如果网盘已接入手机的系统文件列表，也可以在文件选择器的位置或侧边菜单中找到它。
        </Text>
        <Text style={s.muted}>
          仅有云文档链接或提取码时，请先在来源 App
          中打开并下载。苹果接收后请打开
          DeepTutor，在“待接收资料”中核对账号并确认保存。
        </Text>
      </View>
    </Page>
  );
}
