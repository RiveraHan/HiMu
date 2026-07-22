import { Image } from "expo-image";
import { Music } from "lucide-react-native";
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
  testID,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const isRow = variant === "row";

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
      testID={testID}
      style={({ pressed }) => [
        isRow ? styles.rootRow : styles.rootTile,
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
}));
