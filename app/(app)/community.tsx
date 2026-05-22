import { Stack } from "expo-router";
import { ScrollView, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export default function CommunityScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Community" }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text style={styles.text}>Community (coming soon)</Text>
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
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.pageMargin,
  },
  text: {
    ...theme.typography.bodyLg,
    color: theme.colors.onSurfaceVariant,
  },
}));
