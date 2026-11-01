import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
import { Button, C, Field, Icon, Page, s } from "../ui";
export default function Login() {
  const { user, login, config, editConnections } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (user) return <Redirect href="/(tabs)" />;
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await login(username, password);
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={[s.pageBody, { paddingBottom: 40 }]}>
        <View style={{ paddingTop: 24, gap: 18 }}>
          <View style={s.iconDisc}>
            <Icon name="leaf-outline" size={36} />
          </View>
          <Text style={{ color: C.teal, fontWeight: "700", letterSpacing: 2 }}>
            DeepTutor
          </Text>
          <Text
            style={{
              fontSize: 28,
              lineHeight: 38,
              color: C.ink,
              fontWeight: "700",
            }}
          >
            把不懂的，{"\n"}慢慢学懂。
          </Text>
          <Text style={s.text}>
            属于自己的学习空间，{"\n"}每一次提问与进步都在这里。
          </Text>
        </View>
        <View style={[s.card, { marginTop: 32, gap: 18 }]}>
          <Text style={s.h2}>登录，开始今天的学习</Text>
          <Text style={s.muted}>{config?.origin}</Text>
          <Button title="更换服务" secondary onPress={editConnections} />
          <Field
            label="账号"
            placeholder="输入学习账号"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            editable={!busy}
          />
          <Field
            label="密码"
            placeholder="输入密码"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            onSubmitEditing={submit}
            editable={!busy}
          />
          {error ? (
            <Text
              accessibilityRole="alert"
              style={{ color: C.danger, lineHeight: 22 }}
            >
              {error}
            </Text>
          ) : null}
          <Button
            title={busy ? "正在登录…" : "进入学习空间"}
            busy={busy}
            disabled={!username.trim() || !password}
            onPress={() => void submit()}
          />
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Icon name="lock-closed-outline" size={14} />
            <Text style={s.muted}>安全记住登录，下次直接开始</Text>
          </View>
        </View>
        <Text style={[s.muted, { textAlign: "center", marginTop: 24 }]}>
          登录后，接着上次的内容继续学习
        </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Page>
  );
}
