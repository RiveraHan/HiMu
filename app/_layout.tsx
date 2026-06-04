import { QueryProvider } from "@/src/api/query-provider";
import { PlayerProvider } from "@/src/audio/player-provider";
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
    <QueryProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthInitializer>
          <PlayerProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </PlayerProvider>
        </AuthInitializer>
        <StatusBar style="light" />
      </GestureHandlerRootView>
    </QueryProvider>
  );
}
