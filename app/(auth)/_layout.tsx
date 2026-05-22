import { useAuthStore } from "@/src/stores/auth-store";
import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
  const session = useAuthStore((state) => state.session);

  if (session) return <Redirect href="/(app)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
