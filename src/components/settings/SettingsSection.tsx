import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { GlassCard } from "@/src/components/GlassCard";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { Text } from "@/src/components/Text";

type Props = {
  title: string;
  children: ReactNode;
  tone?: "default" | "destructive";
  testID?: ViewProps["testID"];
};

export function SettingsSection({
  title,
  children,
  tone = "default",
  testID,
}: Props) {
  const destructive = tone === "destructive";
  return (
    <View
      testID={testID}
      style={[styles.section, destructive && styles.destructiveSection]}
    >
      <Text
        variant="labelCaps"
        color={destructive ? "error" : "outline"}
        style={styles.title}
      >
        {title.toUpperCase()}
      </Text>
      <GlassCard style={[styles.card, destructive && styles.destructiveCard]}>
        {children}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  section: {
    gap: theme.spacing.stackSm,
  },
  destructiveSection: {
    paddingTop: theme.spacing.stackLg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.error,
  },
  card: { gap: theme.spacing.stackMd },
  destructiveCard: {
    borderColor: theme.colors.error,
  },
  title: { letterSpacing: 1.5, paddingLeft: 4 },
}));
