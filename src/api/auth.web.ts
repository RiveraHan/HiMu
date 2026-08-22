import type {
  AuthChangeEvent,
  OAuthResponse,
  Session,
  Subscription,
} from "@supabase/supabase-js";
import { supabase } from "./supabase";

function browserOrigin(): string {
  if (typeof window === "undefined") {
    throw new Error("Google sign-in is only available in a browser");
  }
  return window.location.origin;
}

export const authApi = {
  signInWithGoogle: async (): Promise<OAuthResponse["data"]> => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: browserOrigin() },
    });
    if (error) throw error;
    return data;
  },

  signOut: async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getSession: async (): Promise<Session | null> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  onAuthStateChange: (
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): { data: { subscription: Subscription } } => {
    return supabase.auth.onAuthStateChange(callback);
  },
};
