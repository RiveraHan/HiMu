import NetInfo from "@react-native-community/netinfo";
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useAuthStore } from "@/src/stores/auth-store";
import { disposePreferenceCommitQueues } from "@/src/hooks/preference-commit-queue";

async function finalizeScopedQueryRuntime(queryClient: QueryClient) {
  disposePreferenceCommitQueues(queryClient);
  await queryClient.cancelQueries();
  for (const mutation of queryClient.getMutationCache().getAll()) {
    mutation.destroy();
  }
  queryClient.clear();
}

function ScopedQueryRuntime({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 min
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const [lifecycle] = useState(() => ({ generation: 0 }));

  useEffect(
    () =>
      onlineManager.setEventListener((setOnline) =>
        NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
      ),
    [],
  );

  useEffect(() => {
    if (process.env.EXPO_OS === "web") return;
    const subscription = AppState.addEventListener("change", (status) => {
      focusManager.setFocused(status === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const generation = ++lifecycle.generation;
    return () => {
      queueMicrotask(() => {
        if (lifecycle.generation !== generation) return;
        void finalizeScopedQueryRuntime(queryClient);
      });
    };
  }, [lifecycle, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const scopeKey = useAuthStore(
    (state) => state.session?.user.id ?? "signed-out",
  );

  return (
    <ScopedQueryRuntime key={scopeKey}>{children}</ScopedQueryRuntime>
  );
}
