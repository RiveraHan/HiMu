import { QueryProvider } from "@/src/api/query-provider";
import { useAuthInit } from "@/src/hooks/use-auth";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "@/src/theme";

function AuthInitializer({ children }: { children: React.ReactNode }) {
  useAuthInit();
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthInitializer>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthInitializer>
        <StatusBar style="light" />
      </GestureHandlerRootView>
    </QueryProvider>
  );
}
