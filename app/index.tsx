import { authApi } from "@/src/api/auth";
import { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Alert, Button, Text, View } from "react-native";

export default function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authApi.getSession().then(() => setSession);
    const { data: listener } = authApi.onAuthStateChange((_event, session) =>
      setSession(session),
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSignOut = () => {
    setLoading(true);
    authApi
      .signOut()
      .catch(() =>
        Alert.alert("Sign-Out Error", "An error occurred while signing out."),
      )
      .finally(() => setLoading(false));
  };

  const handleSignIn = () => {
    setLoading(true);
    authApi
      .signInWithGoogle()
      .catch(() =>
        Alert.alert(
          "Sign-In Error",
          "An error occurred during Google Sign-In.",
        ),
      )
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#131318",
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "bold" }}>
        HiMu
      </Text>
      <Text style={{ color: "#FFFFFF", fontSize: 16, marginBottom: 20 }}>
        {session
          ? `Welcome, ${session.user.email}`
          : "Please sign in to continue"}
      </Text>
      <Button
        title="Sign In with Google"
        onPress={handleSignIn}
        disabled={loading}
      />
      <View style={{ height: 10 }} />
      <Button title="Sign Out" onPress={handleSignOut} disabled={loading} />
    </View>
  );
}
