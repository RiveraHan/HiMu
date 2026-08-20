import { ReactNode } from "react";
import { GlassCard } from "@/src/components/GlassCard";
import { Text } from "@/src/components/Text";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

type Props = {
  icon: ReactNode;
  value: string;
  label: string;
};

export function StatCard({ icon, value, label }: Props) {
  return (
    <GlassCard style={styles.card}>
      {icon}
      <Text variant="h2">{value}</Text>
      <Text variant="labelCaps" color="onSurfaceVariant">
        {label}
      </Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    flex: 1,
    alignItems: "center",
    gap: theme.spacing.stackSm,
    padding: theme.spacing.stackMd,
  },
}));
