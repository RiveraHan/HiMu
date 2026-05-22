import { authApi } from "@/src/api/auth";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { Stack } from "expo-router";
import { Pressable, ScrollView, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export default function HomeScreen() {
  const user = useCurrentUser();

  return (
    <>
      <Stack.Screen options={{ title: "Inicio" }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text selectable style={styles.title}>
          HiMu
        </Text>
        <Text selectable style={styles.email}>
          Welcome, {user?.email ?? "anonymous"}
        </Text>

        <Pressable onPress={() => authApi.signOut()} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  scrollView: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.pageMargin,
    gap: theme.spacing.stackLg,
  },
  title: {
    ...theme.typography.display,
    color: theme.colors.onSurface,
  },
  email: {
    ...theme.typography.bodyMd,
    color: theme.colors.onSurfaceVariant,
  },
  signOutBtn: {
    backgroundColor: theme.colors.primaryContainer,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.full,
  },
  signOutText: {
    ...theme.typography.bodyLg,
    color: theme.colors.onPrimaryContainer,
  },
}));
