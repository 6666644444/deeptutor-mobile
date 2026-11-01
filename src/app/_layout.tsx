import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AuthProvider, useAuth } from "../lib/auth";
import { Button, C, Empty, Loading, Page } from "../ui";
import Connect from "./connect";
function Routes() {
  const { api, user, booting, bootError, restore, editConnections, needsConnection } = useAuth();
  if (needsConnection && !booting) return <Connect />;
  if (booting)
    return (
      <Page>
        <Loading />
      </Page>
    );
  if (bootError)
    return (
      <Page>
        <Empty
          title="稍后再连接"
          detail={bootError}
          icon="cloud-offline-outline"
        />
        <Button title="重试连接" onPress={() => void restore()} />
        <Button title="管理服务连接" secondary onPress={editConnections} />
      </Page>
    );
  return (
    <>
      <Stack
        key={api?.scope || "signed-out"}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chat/[id]" />
          <Stack.Screen name="question/[id]" />
          <Stack.Screen name="capture" />
          <Stack.Screen name="add-material" options={{ animation: "none" }} />

          <Stack.Screen name="history" />
          <Stack.Screen name="modules" />
          <Stack.Screen name="module" />
        </Stack.Protected>
      </Stack>

    </>
  );
}
export default function RootLayout() {
  const [fonts] = useFonts(Ionicons.font);
  if (!fonts) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Routes />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
