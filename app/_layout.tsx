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
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(app)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen
                name="player"
                options={{
                  presentation: "modal",
                  animation: "slide_from_bottom",
                }}
              />
            </Stack>
          </PlayerProvider>
        </AuthInitializer>
        <StatusBar style="light" />
      </GestureHandlerRootView>
    </QueryProvider>
  );
}
