import { useSyncExternalStore } from "react";
import * as Updates from "expo-updates";
import { OtaController } from "./ota-controller";
import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";
import { APP_RELEASE } from "./app-release";
import { githubUpdate } from "./github-ota";

const adapter = requireOptionalNativeModule<{ prepare(manifest: string | null, signature: string | null): Promise<boolean> }>("LearningUpdates");

function version(manifest: unknown): string | undefined {
  const value = manifest as { extra?: { expoClient?: { extra?: { releaseVersion?: unknown } } } } | undefined;
  const label = value?.extra?.expoClient?.extra?.releaseVersion;
  return typeof label === "string" ? label : undefined;
}
export const ota = new OtaController({
  enabled: Updates.isEnabled && !!adapter && !__DEV__,
  async check() {
    const update = await githubUpdate(Platform.OS, Updates.runtimeVersion || "", APP_RELEASE);
    if (!update) return { available: false };
    await adapter!.prepare(update.manifest, update.signature);
    const result = await Updates.checkForUpdateAsync();
    return { available: result.isAvailable || result.isRollBackToEmbedded,
      version: result.isAvailable ? version(result.manifest) : undefined };
  },
  async download() {
    const result = await Updates.fetchUpdateAsync();
    return { ready: result.isNew || result.isRollBackToEmbedded,
      version: result.isNew ? version(result.manifest) : undefined };
  },
  reload: () => Updates.reloadAsync(),
});
export const useOta = () => useSyncExternalStore(ota.subscribe, ota.getSnapshot, ota.getSnapshot);
