import { Image } from "expo-image";
import { Music } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { Text } from "./Text";

type Props = {
  cover?: string | null;
  blurhash?: string;
  name: string;
  trackCount: number;
  onPress?: () => void;
  testID?: string;
};

export function PlaylistCard({
  cover,
  blurhash,
  name,
  trackCount,
  onPress,
  testID,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const countLabel = t("common.counts.tracks", { count: trackCount });

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      {cover ? (
        <Image
          source={cover}
          placeholder={blurhash ? { blurhash } : undefined}
          transition={200}
          contentFit="cover"
          style={styles.cover}
        />
      ) : (
        <View style={[styles.cover, styles.coverFallback]}>
          <Music size={28} color={theme.colors.onSurfaceVariant} />
        </View>
      )}

      <View style={styles.meta}>
        <Text variant="bodyMd" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="labelCaps" color="onSurfaceVariant">
          {countLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.spacing.stackSm,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  cover: {
    aspectRatio: 1,
    width: "100%",
    borderRadius: theme.borderRadius.md,
    borderCurve: "continuous",
    backgroundColor: theme.colors.glassTint,
  },
  coverFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  meta: {
    gap: 2,
  },
}));
