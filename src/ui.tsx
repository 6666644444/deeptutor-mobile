import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ColorValue,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
export const C = {
  bg: "#F6F8F7",
  white: "#FFFFFF",
  ink: "#183B39",
  muted: "#6D827E",
  teal: "#087F78",
  pale: "#E5F3EE",
  line: "#E2EAE6",
  peach: "#FFF0E3",
  orange: "#B56529",
  danger: "#B14B45",
};
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export const Icon = ({
  name,
  size = 22,
  color = C.teal,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) => <Ionicons name={name} size={size} color={color} />;
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
  busy = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: IconName;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (disabled || busy) && { opacity: 0.55 },
        pressed && { opacity: 0.75 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? C.teal : C.white} />
      ) : icon ? (
        <Icon name={icon} size={20} color={secondary ? C.teal : C.white} />
      ) : null}
      <Text style={[s.buttonText, secondary && { color: C.teal }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Page({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={s.page}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.pageBody}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}
export function Heading({
  title,
  sub,
  back = false,
  right,
}: {
  title: string;
  sub?: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <View style={s.heading}>
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          style={s.iconButton}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)")
          }
        >
          <Icon name="chevron-back" />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.h1}>{title}</Text>
        {sub && <Text style={s.sub}>{sub}</Text>}
      </View>
      {right}
    </View>
  );
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={s.section}>
      <Text style={s.h2}>{title}</Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ padding: 8 }}
        >
          <Text style={s.link}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}
export function Empty({
  title,
  detail,
  icon = "leaf-outline",
}: {
  title: string;
  detail: string;
  icon?: IconName;
}) {
  return (
    <View style={s.empty}>
      <View style={s.iconDisc}>
        <Icon name={icon} size={32} />
      </View>
      <Text style={s.h2}>{title}</Text>
      <Text style={[s.muted, { textAlign: "center", lineHeight: 23 }]}>
        {detail}
      </Text>
    </View>
  );
}
export function Failure({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <View style={s.notice}>
      <Text style={{ color: C.danger, lineHeight: 22 }}>{message}</Text>
      <Pressable onPress={retry} style={{ paddingVertical: 10 }}>
        <Text style={s.link}>重新尝试</Text>
      </Pressable>
    </View>
  );
}
export function Loading() {
  return (
    <View style={{ padding: 35 }}>
      <ActivityIndicator color={C.teal} />
      <Text style={[s.muted, { textAlign: "center", marginTop: 10 }]}>
        正在读取学习资料…
      </Text>
    </View>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#98A6A3"
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 110, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Row({
  title,
  detail,
  icon = "document-text-outline",
  onPress,
  suffix,
}: {
  title: string;
  detail?: string;
  icon?: IconName;
  onPress: () => void;
  suffix?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: C.pale }]}
    >
      <View style={s.smallDisc}>
        <Icon name={icon} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={s.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        {detail && (
          <Text style={s.muted} numberOfLines={2}>
            {detail}
          </Text>
        )}
      </View>
      {suffix && <Text style={s.muted}>{suffix}</Text>}
      <Icon name="chevron-forward" size={17} color={C.muted} />
    </Pressable>
  );
}
export function openModule(path: string, title: string) {
  router.push({ pathname: "/module", params: { path, title } });
}
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  pageBody: {
    paddingHorizontal: 22,
    paddingBottom: 30,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 18,
    paddingBottom: 24,
  },
  h1: { fontSize: 25, lineHeight: 34, fontWeight: "700", color: C.ink },
  h2: { fontSize: 18, fontWeight: "700", color: C.ink },
  sub: { marginTop: 5, fontSize: 13, color: C.muted, lineHeight: 20 },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 26,
    marginBottom: 12,
  },
  link: { color: C.teal, fontWeight: "600", fontSize: 14 },
  muted: { color: C.muted, fontSize: 13, lineHeight: 20 },
  text: { color: C.ink, fontSize: 16, lineHeight: 27 },
  card: {
    backgroundColor: C.white,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: C.line,
  },
  hero: { backgroundColor: C.teal, borderRadius: 26, padding: 24, gap: 12 },
  button: {
    minHeight: 50,
    borderRadius: 15,
    paddingHorizontal: 19,
    paddingVertical: 13,
    backgroundColor: C.teal,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonText: { fontSize: 16, fontWeight: "600", color: C.white },
  secondary: { backgroundColor: C.pale },
  label: { fontSize: 14, color: C.ink, fontWeight: "600" },
  input: {
    borderRadius: 14,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: C.ink,
    minHeight: 52,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 10,
  },
  rowTitle: { fontSize: 15, lineHeight: 23, color: C.ink, fontWeight: "600" },
  iconDisc: {
    width: 68,
    height: 68,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.pale,
  },
  smallDisc: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: C.pale,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: C.white,
  },
  empty: {
    paddingVertical: 38,
    paddingHorizontal: 22,
    gap: 16,
    alignItems: "center",
  },
  notice: {
    padding: 16,
    backgroundColor: "#FFF4ED",
    borderRadius: 15,
    marginVertical: 12,
  },
  tag: {
    backgroundColor: C.pale,
    color: C.teal,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
    fontSize: 12,
  },
});
