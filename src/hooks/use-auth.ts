import { authApi } from "@/src/api/auth";
import { useAuthStore } from "@/src/stores/auth-store";
import { useEffect } from "react";

export const useAuthInit = () => {
  const setSession = useAuthStore((state) => state.setSession);
  const setIsLoading = useAuthStore((state) => state.setIsLoading);

  useEffect(() => {
    let active = true;
    let receivedAuthEvent = false;

    const initializeAuth = async () => {
      try {
        const session = await authApi.getSession();
        if (active && !receivedAuthEvent) setSession(session);
      } catch (error) {
        if (!active) return;
        console.error("[useAuthInit] Failed to initialize auth:", error);
        if (!receivedAuthEvent) setSession(null);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = authApi.onAuthStateChange((_event, session) => {
      if (!active) return;
      receivedAuthEvent = true;
      setSession(session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setSession, setIsLoading]);
};

export const useCurrentUser = () => {
  return useAuthStore((state) => state.session?.user ?? null);
} 
