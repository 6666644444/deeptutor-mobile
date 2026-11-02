import Constants from "expo-constants";

// The publisher bumps package.json; never guess a release from the native
// version, which cannot include SemVer preview identifiers.
export const APP_RELEASE = String(Constants.expoConfig?.extra?.releaseVersion || "");
