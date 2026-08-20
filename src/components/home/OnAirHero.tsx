import { Play } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";
import { catalogLabel } from "@/src/i18n/catalog-labels";
import { Avatar } from "../Avatar";
import { EqualizerBars } from "../EqualizerBars";
import { GlassCard } from "../GlassCard";
import { Text } from "../Text";

type Props = {
  djName: string;
  avatarUrl: string | null;
  genre: string | null;
  headline: string;
  trackTitle: string;
  isLive: boolean;
  onPlay: () => void;
  eyebrow?: string;
  pending?: boolean;
  voiceSlot?: ReactNode;
};

export function OnAirHero({
  djName,
  avatarUrl,
  genre,
  headline,
  trackTitle,
  isLive,
  onPlay,
  eyebrow,
  pending = false,
  voiceSlot,
}: Props) {
  const { t, i18n } = useTranslation();
  const resolvedLanguage = i18n.resolvedLanguage === "es" ? "es" : "en";
  const { theme } = useUnistyles();
  const accent = isLive ? theme.colors.error : theme.colors.primary;
  const displayGenre = genre ? catalogLabel(genre, resolvedLanguage) : null;

  return (
    <GlassCard level={3} style={styles.card}>
      <View style={styles.eyebrow}>
        <EqualizerBars bars={4} height={14} color={accent} />
        <Text variant="labelCaps" color={isLive ? "error" : "primary"}>
          {eyebrow ?? (isLive ? t("home.hero.live") : t("home.hero.onAir"))}
        </Text>
        {displayGenre && (
          <Text
            variant="labelCaps"
            color="onSurfaceVariant"
            opacity={0.7}
            style={styles.genre}
          >
            {displayGenre}
          </Text>
        )}
      </View>

      <View style={styles.main}>
        <Avatar src={avatarUrl} fallback={djName} size="lg" eager />
        <View style={styles.meta}>
          <Text variant="h2" numberOfLines={1}>
            {djName}
          </Text>
          <Text
            variant="bodyMd"
            color="onSurfaceVariant"
            opacity={0.7}
            numberOfLines={2}
          >
            {headline}
          </Text>
        </View>
        {!pending && (
          <Pressable
            onPress={onPlay}
            accessibilityRole="button"
            accessibilityLabel={t("home.hero.playTrack", {
              trackTitle,
              djName,
            })}
            style={({ pressed }) => [
              styles.playButton,
              pressed && styles.pressed,
            ]}
          >
            <Play
              size={22}
              color={theme.colors.onSurface}
              fill={theme.colors.onSurface}
            />
          </Pressable>
        )}
      </View>

      {!pending && (
        <View style={styles.trackRow}>
          <Play size={12} color={theme.colors.onSurfaceVariant} />
          <Text
            variant="bodyMd"
            color="onSurfaceVariant"
            opacity={0.7}
            numberOfLines={1}
            style={styles.trackTitle}
          >
            {trackTitle}
          </Text>
          {voiceSlot}
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: theme.spacing.stackMd,
    minHeight: { xs: undefined, xl: 220 },
    justifyContent: { xs: "flex-start", xl: "center" },
  },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
  genre: {
    marginLeft: "auto",
  },
  main: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.gutter,
  },
  meta: {
    flex: 1,
    gap: theme.spacing.stackXs,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.glassTintStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackXs,
  },
  trackTitle: {
    flex: 1,
  },
}));
