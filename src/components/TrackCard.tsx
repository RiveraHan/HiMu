import { Image } from "expo-image";
import { Check, Lock, Music } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Text } from "./Text";

type Props = {
  title: string;
  cover?: string | null;
  blurhash?: string;
  artist: string;
  variant?: "tile" | "row";
  isPlaying?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  highlighted?: boolean;
  highlightedLabel?: string;
  isPrivate?: boolean;
  privateLabel?: string;
  testID?: string;
};
export function TrackCard({
  title,
  cover,
  blurhash,
  artist,
  variant = "tile",
  isPlaying = false,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  highlighted = false,
  highlightedLabel,
  isPrivate = false,
  privateLabel,
  testID,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const isRow = variant === "row";
  const spokenLabel = [
    accessibilityLabel ?? `${title}, ${artist}`,
    isPrivate ? privateLabel : null,
  ]
    .filter(Boolean)
    .join(", ");

  const coverNode = cover ? (
    <Image
      source={cover}
      placeholder={blurhash ? { blurhash } : undefined}
      transition={200}
      contentFit="cover"
      style={isRow ? styles.coverRow : styles.coverTile}
    />
  ) : (
    <View
      style={[isRow ? styles.coverRow : styles.coverTile, styles.coverFallback]}
    >
      <Music size={28} color={theme.colors.onSurfaceVariant} />
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={spokenLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityState={{ selected: highlighted }}
      testID={testID}
      style={({ pressed }) => [
        isRow ? styles.rootRow : styles.rootTile,
        isRow && highlighted && styles.highlightedRow,
        pressed && styles.pressed,
      ]}
    >
      {coverNode}
      <View style={isRow ? styles.metaRow : styles.metaTile}>
        <Text variant="bodyMd" numberOfLines={1}>
          {title}
        </Text>
        <Text
          variant="bodyMd"
          numberOfLines={1}
          color="onSurfaceVariant"
          opacity={0.7}
        >
          {artist}
        </Text>
        {isPlaying && (
          <Text variant="labelCaps" color="primary">
            {t("common.states.nowPlaying")}
          </Text>
        )}
        {isPrivate && privateLabel ? (
          <View style={styles.privateBadge}>
            <Lock size={14} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelCaps" color="onSurfaceVariant">
              {privateLabel}
            </Text>
          </View>
        ) : null}
        {highlighted && highlightedLabel ? (
          <View style={styles.highlightBadge}>
            <Check size={14} color={theme.colors.primary} />
            <Text variant="labelCaps" color="primary">
              {highlightedLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  rootTile: {
    gap: theme.spacing.stackSm,
  },
  rootRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
  highlightedRow: {
    padding: theme.spacing.stackSm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.glassTintStrong,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
  },
  coverTile: {
    aspectRatio: 1,
    width: "100%",
    borderRadius: theme.borderRadius.md,
    borderCurve: "continuous",
    backgroundColor: theme.colors.glassTint,
  },
  coverRow: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.sm,
    borderCurve: "continuous",
    backgroundColor: theme.colors.glassTint,
  },
  coverFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  metaTile: {
    gap: 2,
  },
  metaRow: {
    flex: 1,
    gap: 2,
  },
  highlightBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: theme.spacing.stackXs,
  },
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: theme.spacing.stackXs,
  },
}));
