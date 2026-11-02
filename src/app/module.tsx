// Compatibility route for links from earlier builds. This route never loads a website.
import { Redirect, useLocalSearchParams } from "expo-router";
import { nativeDestination } from "../lib/native-routes";
export default function LegacyModule() {
  const { path = "/" } = useLocalSearchParams<{ path: string }>();
  return <Redirect href={nativeDestination(path)} />;
}
