import { GlassCard, Text } from "@/src/components";
import { ReactNode } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

type Props = {
  title: string;
  icon?: ReactNode;
  subtitle?: string;
  children: ReactNode;
};

export function PrefSection({ title, icon, subtitle, children }: Props) {
  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        {!!icon && <View style={styles.icon}>{icon}</View>}
        <View style={styles.headerText}>
          <Text variant="bodyLg">{title}</Text>
          {!!subtitle && (
            <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.7}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {children}
    </GlassCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: theme.spacing.stackMd,
  },
  header: {
    flexDirection: "row",
    gap: theme.spacing.stackSm,
    alignItems: "flex-start",
  },
  icon: {
    paddingTop: 2,
  },
  headerText: {
    flex: 1,
    gap: theme.spacing.stackXs,
  },
}));
