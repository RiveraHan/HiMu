import { ChevronRight, Waves } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";
import { catalogLabel } from "@/src/i18n/catalog-labels";
import { Text } from "../Text";

type Props = {
  hours: string;
  topGenre: string | null;
  streak: number;
  onPress: () => void;
};

export function VibeSpotlightCard({
  hours,
  topGenre,
  streak,
  onPress,
}: Props) {
  const { t, i18n } = useTranslation();
  const resolvedLanguage = i18n.resolvedLanguage === "es" ? "es" : "en";
  const { theme } = useUnistyles();

  const subtitle = [
    topGenre
      ? t("home.vibe.mostly", {
          genre: catalogLabel(topGenre, resolvedLanguage),
        })
      : null,
    t("home.vibe.streak", { count: streak }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("home.vibe.open")}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <View style={styles.iconSlot}>
        <Waves size={22} color={theme.colors.tertiary} />
      </View>
      <View style={styles.body}>
        <Text variant="labelCaps" color="onSurfaceVariant" opacity={0.7}>
          {t("home.vibe.thisWeek")}
        </Text>
        <View style={styles.numberRow}>
          <Text variant="h2">{hours}</Text>
          <Text variant="labelCaps" color="onSurfaceVariant">
            {t("home.vibe.hours")}
          </Text>
        </View>
        <Text
          variant="bodyMd"
          color="onSurfaceVariant"
          opacity={0.6}
          numberOfLines={1}
        >
          {subtitle}
        </Text>
      </View>
      <ChevronRight size={20} color={theme.colors.onSurfaceVariant} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.gutter,
    padding: theme.spacing.stackMd,
    borderRadius: theme.borderRadius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassTint,
    overflow: "hidden",
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  iconSlot: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    gap: 2,
  },
  numberRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: theme.spacing.stackXs,
  },
}));
