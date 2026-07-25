import { getListeningIdentity } from "@/src/utils/listening-identity";
import { ReactNode } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { GlassCard } from "../GlassCard";
import { Text } from "../Text";
import { useTranslation } from "react-i18next";

type Props = { icon: ReactNode; genre: string | null; pct: number };

export function TopGenreCard({ icon, genre, pct }: Props) {
  const { t } = useTranslation();
  const identity = getListeningIdentity(genre);

  return (
    <GlassCard style={styles.card}>
      <View style={styles.icon}>{icon}</View>
      <View style={styles.text}>
        <Text variant="bodyLg">
          {t(`profile.identities.${identity.id}.title`)}
        </Text>
        <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.7}>
          {t(`profile.identities.${identity.id}.description`)}
        </Text>
      </View>
      {genre && (
        <Text variant="h2" color="primary">
          {Math.round(pct * 100)}%
        </Text>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.gutter,
  },
  icon: { paddingTop: 2 },
  text: { flex: 1, gap: theme.spacing.stackXs },
}));
