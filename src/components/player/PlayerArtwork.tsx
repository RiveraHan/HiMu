import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { ImageOff, RefreshCw } from "lucide-react-native";

import { HimuImage } from "@/src/components/media/HimuImage";
import { Text } from "@/src/components/Text";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";

type Props = {
  source: string | null;
  accessibilityLabel: string;
  onRetry?: () => void;
  onDisplay?: () => void;
};

/**
 * A reserved album-art frame. Image retries are local request retries and are
 * intentionally separate from the owner-only cover regeneration mutation.
 */
export function PlayerArtwork({
  source,
  accessibilityLabel,
  onRetry,
  onDisplay,
}: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();
  const [retryKey, setRetryKey] = useState(0);
  const [hasDisplayed, setHasDisplayed] = useState(false);

  useEffect(() => {
    setHasDisplayed(false);
  }, [source]);

  const retry = () => {
    setRetryKey((key) => key + 1);
    onRetry?.();
  };

  return (
    <View style={styles.container}>
      <HimuImage
        testID="player-artwork"
        source={source}
        retryKey={retryKey}
        accessibilityLabel={accessibilityLabel}
        componentLabel="player artwork"
        contentFit="cover"
        transition={0}
        onLoad={() => {
          setHasDisplayed(true);
          onDisplay?.();
        }}
        style={styles.frame}
        fallback={
          <View testID="player-artwork-fallback" style={styles.fallback}>
            <ImageOff size={36} color={theme.colors.onSurfaceVariant} />
            <Text variant="labelCaps" color="onSurfaceVariant">
              {t("playback.player.artwork.unavailable")}
            </Text>
          </View>
        }
      />
      {source && !hasDisplayed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("playback.player.artwork.retry")}
          onPress={retry}
          style={styles.retry}
        >
          <RefreshCw size={16} color={theme.colors.primary} />
          <Text variant="labelCaps" color="primary">
            {t("playback.player.artwork.retry")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
  },
  frame: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: theme.borderRadius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.surfaceContainerHigh,
    overflow: "hidden",
    ...(process.env.EXPO_OS === "ios"
      ? { boxShadow: "0 30px 60px rgba(0,0,0,0.6)" }
      : { elevation: 16 }),
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.stackSm,
    padding: theme.spacing.stackLg,
  },
  retry: {
    position: "absolute",
    right: theme.spacing.stackSm,
    bottom: theme.spacing.stackSm,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.stackXs,
    paddingHorizontal: theme.spacing.stackMd,
  },
}));
