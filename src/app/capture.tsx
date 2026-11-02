import { ownTemporaryFile } from "../lib/temporary-files";
import { useState } from "react";
import { Alert, Image, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useAuth } from "../lib/auth";
import { Photo, photoDraft } from "../lib/drafts";
import { Button, Empty, Heading, Page, s } from "../ui";
export default function Capture() {
  const { api } = useAuth();
  const [photo, setPhoto] = useState<Photo>();
  const [busy, setBusy] = useState(false);
  async function pick(camera: boolean) {
    setBusy(true);
    try {
      if (
        camera &&
        !(await ImagePicker.requestCameraPermissionsAsync()).granted
      ) {
        Alert.alert("需要相机权限", "也可以选择相册里的题目照片。");
        return;
      }
      const result = await (
        camera
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync
      )({
        mediaTypes: ["images"],
        allowsEditing: true,
        base64: true,
        quality: 0.8,
      });
      if (!result.canceled) {
        const a = result.assets[0];
        if (!a.base64) throw new Error("图片未能读取，请重新选择。");
        if (a.base64.length > 10 * 1024 * 1024)
          throw new Error("照片较大，请裁剪到一道题再试。");
        if (!api) return;
        const uri = await ownTemporaryFile(api, a.uri, "question.jpg");
        setPhoto({ uri, base64: a.base64, filename: "question.jpg" });
      }
    } catch (e) {
      Alert.alert("未能取得照片", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <Heading title="拍下这道题" sub="一次拍一道，题目和作答会更清楚" back />
      {photo ? (
        <Image
          accessibilityLabel="待提交的题目照片"
          source={{ uri: photo.uri }}
          resizeMode="contain"
          style={{
            width: "100%",
            height: 320,
            borderRadius: 20,
            backgroundColor: "#E7EEEA",
            marginBottom: 20,
          }}
        />
      ) : (
        <Empty
          title="让题目清楚地出现在画面里"
          detail="拍照或从相册选择后，可以先裁剪和旋转。"
          icon="camera-outline"
        />
      )}
      <View style={{ gap: 12 }}>
        <Button
          title="拍照"
          icon="camera-outline"
          busy={busy}
          onPress={() => void pick(true)}
        />
        <Button
          title="从相册选择"
          icon="images-outline"
          secondary
          disabled={busy}
          onPress={() => void pick(false)}
        />
        {photo && (
          <Button
            title="提交照片，识别并讲解"
            onPress={() => {
              if (api) {
                photoDraft.set(api, photo);
                router.replace({
                  pathname: "/chat/[id]",
                  params: { id: "new", photo: "1" },
                });
              }
            }}
          />
        )}
      </View>
      <Text style={[s.muted, { marginTop: 20 }]}>
        提交后交给学习服务识别；识别内容需要校对，确认后再加入错题本。
      </Text>
    </Page>
  );
}
