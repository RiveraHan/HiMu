import { secureStorage } from "@/src/lib/secure-storage";
import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type State = {
  session: Session | null;
  setSession: (session: Session | null) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
};

export const useAuthStore = create<State>()(
  persist(
    (set) => ({
      session: null,
      isLoading: true,
      setSession: (session) => set({ session }),
      setIsLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: "auth-store",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ session: state.session }),
    },
  ),
);
