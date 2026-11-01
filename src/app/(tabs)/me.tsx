import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";
import {
  Button,
  C,
  Heading,
  Page,
  Row,
  Section,
  openModule,
  s,
} from "../../ui";
export default function Me() {
  const { api, user, logout, config, editConnections } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <Page>
      <Heading title="我的" sub="记录我的学习与进步" />
      <View
        style={[
          s.card,
          { flexDirection: "row", alignItems: "center", gap: 16 },
        ]}
      >
        <View style={s.iconDisc}>
          <Text style={{ fontSize: 29, color: C.teal, fontWeight: "700" }}>
            我
          </Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={s.h1}>我的账号</Text>
          <Text style={s.muted}>{api?.mode === "anonymous" ? "单用户免登录空间" : `登录账号：${user?.username}`}</Text>
        </View>
        <Text style={s.tag}>{api?.mode === "anonymous" ? "已连接" : "已登录"}</Text>
      </View>
      <Section title="学习记录" />
      <Row
        title="全部功能"
        detail="问答、阅读、出题、研究与更多"
        icon="grid-outline"
        onPress={() => router.push("/modules")}
      />
      <Row
        title="历史对话"
        icon="chatbubbles-outline"
        onPress={() => router.push("/history")}
      />
      <Row
        title="学习记忆"
        detail="回顾学过的内容与学习偏好"
        icon="sparkles-outline"
        onPress={() => openModule("/memory", "学习记忆")}
      />
      <Row
        title="学习工作区"
        icon="layers-outline"
        onPress={() => openModule("/settings/workspace", "学习工作区")}
      />
      <Section title="服务连接" />
      <Row title={config?.kind === "computer" ? "我的电脑" : "我的服务器"} detail={config?.origin} icon="server-outline" onPress={editConnections} />
      <Button title="管理或更换服务" secondary onPress={editConnections} />
      <Section title="登录与隐私" />
      <View style={[s.card, { gap: 10 }]}>
        <Text style={s.rowTitle}>{api?.mode === "anonymous" ? "此服务未启用账号认证" : "已安全记住登录"}</Text>
        <Text style={s.muted}>
          再次打开会自动恢复。资料和错题归当前账号保存，换人使用时请先退出。
        </Text>
      </View>
      <View style={{ marginTop: 20 }}>
        <Button
          title="退出当前账号"
          secondary
          busy={busy}
          onPress={() =>
            Alert.alert(
              "退出当前账号？",
              "会清除此设备保存的登录信息，服务器上的资料保持不变。",
              [
                { text: "取消", style: "cancel" },
                {
                  text: "退出",
                  style: "destructive",
                  onPress: () => {
                    setBusy(true);
                    void logout().catch(() => {
                      setBusy(false);
                      Alert.alert("暂未退出", "请重试。");
                    });
                  },
                },
              ],
            )
          }
        />
      </View>
      <Text style={[s.muted, { textAlign: "center", marginTop: 25 }]}>
        DeepTutor 移动版 · 0.1.0
      </Text>
    </Page>
  );
}
