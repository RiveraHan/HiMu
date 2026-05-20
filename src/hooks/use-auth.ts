import { authApi } from "@/src/api/auth";
import { useAuthStore } from "@/src/stores/auth-store";
import { useEffect } from "react";

export const useAuthInit = () => {
  const setSession = useAuthStore((state) => state.setSession);
  const setIsLoading = useAuthStore((state) => state.setIsLoading);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const session = await authApi.getSession();
        setSession(session);
      } catch (error) {
        console.error("[useAuthInit] Failed to initialize auth:", error);
        setSession(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = authApi.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession, setIsLoading]);
};

export const useCurrentUser = () => {
  return useAuthStore((state) => state.session?.user ?? null);
} 
