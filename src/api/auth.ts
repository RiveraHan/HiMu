import { GoogleSignin } from "@react-native-google-signin/google-signin";
import type {
  AuthChangeEvent,
  AuthResponse,
  Session,
  Subscription,
} from "@supabase/supabase-js";
import { supabase } from "./supabase";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  scopes: ["profile", "email"],
});

export const authApi = {
  signInWithGoogle: async (): Promise<AuthResponse["data"] | null> => {
    await GoogleSignin.hasPlayServices();

    const response = await GoogleSignin.signIn();
    if (response.type !== "success") return null;

    const { idToken } = await GoogleSignin.getTokens();
    if (!idToken) throw new Error("Google did not return an ID token");

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });
    if (error) throw error;
    return data;
  },

  signOut: async (): Promise<void> => {
    await GoogleSignin.signOut().catch(() => {});
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
