import { Redirect } from "expo-router";
import { useAuth } from "../lib/auth";
export default function Index() {
  return <Redirect href={useAuth().user ? "/(tabs)" : "/login"} />;
}
