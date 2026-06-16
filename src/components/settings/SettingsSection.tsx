import type { ReactNode } from "react";
import { View } from "react-native";
import { GlassCard } from "@/src/components/GlassCard";
import { StyleSheet } from "react-native-unistyles";
import { Text } from "@/src/components/Text";

type Props = {
  title: string;
  children: ReactNode;
};

export function SettingsSection({ title, children }: Props) {
  return (
    <View style={styles.section}>
      <Text variant="labelCaps" color="outline" style={styles.title}>
        {title.toUpperCase()}
      </Text>
      <GlassCard style={styles.card}>{children}</GlassCard>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  section: {
    gap: theme.spacing.stackSm,
  },
  card: { gap: theme.spacing.stackMd },
  title: { letterSpacing: 1.5, paddingLeft: 4 },
}));
