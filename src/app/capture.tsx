import { pickQuestionPhoto } from "../lib/pick-photo";
import { useState } from "react";
import { Alert, Image, Text, View } from "react-native";
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
      if (!api) return;
      const selected = await pickQuestionPhoto(api, camera);
      if (selected) setPhoto(selected);
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
