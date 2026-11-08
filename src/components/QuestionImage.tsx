import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FormModal } from "../features/common";
import { Button, C, Heading } from "../ui";

export function QuestionImage({ uri, onError }: { uri: string; onError?: () => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="查看题目原图" onPress={() => setOpen(true)}>
      <Image source={{ uri }} onError={onError} resizeMode="contain" style={{ width: "100%", height: 220, borderRadius: 12, backgroundColor: C.white }} />
    </Pressable>
    {open ? <FormModal onClose={() => setOpen(false)}><SafeAreaView style={{ flex: 1, backgroundColor: C.white }}>
      <View style={{ padding: 18 }}><Heading title="题目照片" right={<Button title="关闭" secondary onPress={() => setOpen(false)} />} /></View>
      <Image accessibilityLabel="题目原图" source={{ uri }} resizeMode="contain" style={{ flex: 1, width: "100%", marginBottom: 16 }} />
    </SafeAreaView></FormModal> : null}
  </>;
}
