import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { Alert } from "react-native";
import { supabase } from "./supabase";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  scopes: ["profile", "email"],
});

export const authApi = {
  signInWithGoogle: async () => {
    try {
      await GoogleSignin.hasPlayServices();

      const response = await GoogleSignin.signIn();
      if (response.type !== "success") return null;

      const { idToken } = await GoogleSignin.getTokens();

      if (!idToken)
        throw new Error("Failed to get id token from Google Sign-In");

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error) throw error;

      return data;
    } catch (error: any) {
      switch (error.code) {
        case statusCodes.IN_PROGRESS:
          Alert.alert(
            "Sign-In in progress",
            "Please wait while we sign you in with Google.",
          );
          break;
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          Alert.alert(
            "Google Play Services not available",
            "Please ensure Google Play Services are installed and up to date.",
          );
          break;
        default:
          Alert.alert(
            "Sign-In Error",
            "An unknown error occurred during Google Sign-In",
          );
      }
    }
  },

  signOut: async () => {
    await GoogleSignin.signOut().catch(() => {});
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  onAuthStateChange: (
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};
