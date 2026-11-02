import { useState, useRef } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Button,
  C,
  Empty,
  Failure,
  Field,
  Heading,
  Loading,
  Page,
  s,
} from "../ui";
import { useAuth } from "../lib/auth";
import { TutorClient } from "../lib/client";
import { chatDraft } from "../lib/drafts";
import { MathProse } from "./math";
import { hasMath } from "../lib/math-markup";

export const enc = encodeURIComponent;
export function feature(
  area: string,
  id = "",
  extra: Record<string, string> = {},
) {
  router.push({ pathname: "/feature", params: { area, id, ...extra } });
}
export function ask(
  api: TutorClient,
  content: string,
  context: Record<string, unknown> = {},
) {
  chatDraft.set(api, { content, context });
  router.push("/chat/new");
}
export function Chips({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginVertical: 10,
      }}
    >
      {items.map((i) => (
        <Pressable
          key={i.value}
          accessibilityRole="button"
          accessibilityState={{ selected: i.value === value }}
          onPress={() => onChange(i.value)}
          style={{
            padding: 12,
            borderRadius: 14,
            backgroundColor: i.value === value ? C.teal : C.white,
            borderWidth: 1,
            borderColor: C.line,
          }}
        >
          <Text style={{ color: i.value === value ? C.white : C.ink }}>
            {i.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function ResourceState({
  resource,
  empty,
}: {
  resource: {
    loading: boolean;
    error: string;
    data: unknown;
    reload: () => void;
  };
  empty?: boolean;
}) {
  if (resource.error)
    return <Failure message={resource.error} retry={resource.reload} />;
  if (resource.loading && !resource.data) return <Loading />;
  return empty ? (
    <Empty title="这里还没有内容" detail="添加内容后，会显示在这里。" />
  ) : null;
}
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  async function run(fn: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }
  return { busy, error, run };
}
export type InputSpec = {
  key: string;
  label: string;
  value?: string;
  multiline?: boolean;
  required?: boolean;
  number?: boolean;
  options?: { value: string; label: string }[];
};
// Keep one KeyboardProvider at the app root. Multiple providers overwrite the
// native Modal's dismissal listener and leave the main keyboard callback suspended.
// Resize the modal form independently using native keyboard frame notifications.
export function FormModal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (Keyboard.isVisible()) Keyboard.dismiss();
        else onClose();
      }}
    >
      <SafeAreaProvider>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {children}
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  );
}
export function Editor({
  title,
  fields,
  onSave,
  onClose,
}: {
  title: string;
  fields: InputSpec[];
  onSave: (values: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((f) => [f.key, f.value ?? f.options?.[0]?.value ?? ""]),
    ),
  );
  const action = useAction();
  return (
    <FormModal onClose={onClose}>
      <Page>
        <Heading
          title={title}
          right={<Button title="取消" secondary onPress={onClose} />}
        />
        <View style={{ gap: 18 }}>
          {fields.map((f) =>
            f.options ? (
              <View key={f.key}>
                <Text style={s.label}>{f.label}</Text>
                <Chips
                  items={f.options}
                  value={values[f.key]}
                  onChange={(v) => setValues((x) => ({ ...x, [f.key]: v }))}
                />
              </View>
            ) : (
              <Field
                key={f.key}
                label={f.label}
                value={values[f.key]}
                onChangeText={(v) => setValues((x) => ({ ...x, [f.key]: v }))}
                multiline={f.multiline}
                keyboardType={f.number ? "numeric" : "default"}
              />
            ),
          )}
          {action.error ? (
            <Text style={{ color: C.danger }}>{action.error}</Text>
          ) : null}
          <Button
            title="保存"
            busy={action.busy}
            disabled={fields.some((f) => f.required && !values[f.key]?.trim())}
            onPress={() =>
              void action.run(async () => {
                await onSave(values);
                onClose();
              })
            }
          />
        </View>
      </Page>
    </FormModal>
  );
}
export function confirmDelete(title: string, action: () => Promise<void>) {
  Alert.alert(`删除${title}？`, "删除后无法恢复，请确认当前选中的内容。", [
    { text: "取消", style: "cancel" },
    {
      text: "删除",
      style: "destructive",
      onPress: () =>
        void action().catch((e) => Alert.alert("未能删除", e.message)),
    },
  ]);
}
export function Actions({ children }: { children: React.ReactNode }) {
  return <View style={{ gap: 10, marginVertical: 12 }}>{children}</View>;
}
export function SmallAction({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ padding: 10 }}
    >
      <Text style={s.link}>{title}</Text>
    </Pressable>
  );
}
// Markdown stays native Text: headings, lists, code and quotations keep selection.
// HTML is never evaluated here and server content cannot navigate the app.
export function Prose({ text }: { text: unknown }) {
  if (typeof text !== "string" || !text.trim()) return null;
  if (hasMath(text)) return <MathProse text={text} />;
  return (
    <View style={{ gap: 7 }}>
      {text.split("\n").map((line, i) => {
        const h = /^(#{1,6})\s+(.*)/.exec(line);
        return (
          <Text
            key={i}
            selectable
            style={[
              s.text,
              h && { fontWeight: "700", fontSize: h[1].length < 3 ? 21 : 18 },
              line.startsWith(">") && {
                color: C.muted,
                borderLeftWidth: 3,
                borderColor: C.teal,
                paddingLeft: 12,
              },
            ]}
          >
            {h
              ? h[2]
              : line.replace(/^[-*]\s+/, "• ").replace(/\*\*(.*?)\*\*/g, "$1")}
          </Text>
        );
      })}
    </View>
  );
}
export function Refresh({ onPress }: { onPress: () => void }) {
  return <SmallAction title="刷新" onPress={onPress} />;
}
export function AccountNote() {
  const { user } = useAuth();
  return <Text style={s.muted}>保存到 {user?.username} 的学习空间</Text>;
}
