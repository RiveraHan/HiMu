import { QueryProvider } from "@/src/api/query-provider";
import { PlayerProvider } from "@/src/audio/player-provider";
import { ConfirmDialogHost } from "@/src/components/ConfirmDialog";
import { MiniPlayer } from "@/src/components/MiniPlayer";
import { ToastHost } from "@/src/components/Toast";
import { useAuthInit } from "@/src/hooks/use-auth";
import { AppTourProvider } from "@/src/onboarding";
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
            <AppTourProvider>
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
                <Stack.Screen name="account-settings" />
                <Stack.Screen name="preferences" />
                <Stack.Screen name="favorites" />
                <Stack.Screen name="vibe-check" />
                <Stack.Screen name="dj/[id]" />
                <Stack.Screen name="focus-mode" options={{ animation: "fade" }} />
                <Stack.Screen name="create-dj" />
                <Stack.Screen name="train-dj/[id]" />
              </Stack>
              <MiniPlayer />
            </AppTourProvider>
            <ToastHost />
            <ConfirmDialogHost />
          </PlayerProvider>
        </AuthInitializer>
        <StatusBar style="light" />
      </GestureHandlerRootView>
    </QueryProvider>
  );
}
