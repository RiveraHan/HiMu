import { useAuthInit } from "@/src/hooks/use-auth";
import "@/src/theme";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

function AuthInitializer({ children }: { children: React.ReactNode }) {
  useAuthInit();
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthInitializer>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthInitializer>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}
