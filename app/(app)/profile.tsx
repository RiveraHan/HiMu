import { Stack } from "expo-router";
import React from "react";
import { ScrollView, Text } from "react-native";
import { StyleSheet } from "react-native-unistyles";

export default function ProfileScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Profile" }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text style={styles.text}>Profile (comming soon)</Text>
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
