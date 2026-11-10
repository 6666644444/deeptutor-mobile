import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
  type ColorValue,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from "react-native-keyboard-controller";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { nativeDestination } from "./lib/native-routes";
export const C = {
  bg: "#F6F8F7",
  white: "#FFFFFF",
  ink: "#183B39",
  muted: "#586E69",
  teal: "#08776F",
  pale: "#E5F3EE",
  line: "#E2EAE6",
  peach: "#FFF0E3",
  orange: "#B56529",
  danger: "#B14B45",
  dangerPale: "#FFF0EE",
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
  compact = false,
  danger = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: IconName;
  busy?: boolean;
  compact?: boolean;
  danger?: boolean;
}) {
  const foreground = danger ? C.danger : secondary ? C.teal : C.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        compact && s.compactButton,
        danger && { backgroundColor: C.dangerPale, borderColor: "#EFCAC4" },
        (disabled || busy) && { opacity: 0.55 },
        pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={foreground} />
      ) : icon ? (
        <Icon name={icon} size={compact ? 18 : 20} color={foreground} />
      ) : null}
      <Text style={[s.buttonText, { color: foreground }, compact && { fontSize: 14, lineHeight: 20 }]}>
        {title}
      </Text>
    </Pressable>
  );
}
// Follow the focused caret, including multiline edits and switching fields while
// the keyboard is already open. The offset is breathing room, not keyboard height.
export function FormScrollView(props: KeyboardAwareScrollViewProps) {
  return (
    <KeyboardAwareScrollView
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...props}
    />
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
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={s.page}>
      {scroll ? (
        <FormScrollView contentContainerStyle={s.pageBody}>
          {children}
        </FormScrollView>
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
  compact = false,
  titleLines,
}: {
  title: string;
  sub?: string;
  back?: boolean;
  right?: React.ReactNode;
  compact?: boolean;
  titleLines?: number;
}) {
  const { width, fontScale } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [actionsWidth, setActionsWidth] = useState(0);
  const availableWidth = measuredWidth || width - 44;
  // Form actions move below the title on a phone. Chat's single menu icon can
  // stay beside it; the full title wraps instead of being cut to 12 characters.
  const titleSpace = availableWidth - actionsWidth - (back ? 64 : 10);
  const stackActions = !!right && !compact && titleSpace < Math.min(220, title.length * 25) * fontScale;
  return (
    <View onLayout={e => setMeasuredWidth(e.nativeEvent.layout.width)} style={[s.heading, compact && { paddingTop: 10, paddingBottom: 12 }, stackActions && { flexWrap: "wrap" }]}>
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
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text accessibilityRole="header" numberOfLines={titleLines} style={[s.h1, compact && { fontSize: 21, lineHeight: 29 }]}>{title}</Text>
        {sub && <Text style={s.sub}>{sub}</Text>}
      </View>
      {right ? <View style={stackActions ? s.headingActions : { flexShrink: 0, maxWidth: "100%" }}>
        <View onLayout={e => setActionsWidth(e.nativeEvent.layout.width)} style={{ alignSelf: "flex-end", maxWidth: "100%" }}>{right}</View>
      </View> : null}
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
      <Text style={[s.h2, { flex: 1, minWidth: 0 }]}>{title}</Text>
      {action && (
        <Button title={action} compact secondary onPress={() => onPress?.()} />
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
      <View style={{ alignSelf: "flex-start", marginTop: 12 }}><Button title="重新尝试" icon="refresh-outline" compact secondary onPress={retry} /></View>
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
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#98A6A3"
        {...props}
        onFocus={e => { setFocused(true); props.onFocus?.(e); }}
        onBlur={e => { setFocused(false); props.onBlur?.(e); }}
        style={[
          s.input,
          props.multiline && { minHeight: 110, textAlignVertical: "top" },
          props.style,
          focused && { borderColor: C.teal, backgroundColor: "#FAFFFC" },
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
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text style={s.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        {detail && (
          <Text style={s.muted} numberOfLines={2}>
            {detail}
          </Text>
        )}
      </View>
      {suffix && <Text style={[s.tag, { maxWidth: "28%", flexShrink: 1 }]}>{suffix}</Text>}
      <Icon name="chevron-forward" size={17} color={C.muted} />
    </Pressable>
  );
}
export function openFeature(path: string, _title?: string) {
  router.push(nativeDestination(path));
}
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg },
  pageBody: {
    paddingHorizontal: 20,
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
  headingActions: { width: "100%", alignItems: "flex-end", paddingTop: 4 },
  h1: { fontSize: 25, lineHeight: 34, fontWeight: "700", color: C.ink },
  h2: { fontSize: 18, fontWeight: "700", color: C.ink },
  sub: { marginTop: 5, fontSize: 13, color: C.muted, lineHeight: 20 },
  section: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 26,
    marginBottom: 12,
    gap: 12,
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
    maxWidth: "100%",
    borderWidth: 1,
    borderColor: "transparent",
  },
  buttonText: { fontSize: 16, lineHeight: 23, fontWeight: "600", color: C.white, flexShrink: 1, textAlign: "center" },
  secondary: { backgroundColor: C.pale, borderColor: "#CDE4DB" },
  compactButton: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14 },
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
    borderWidth: 1,
    borderColor: C.line,
    flexShrink: 0,
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
