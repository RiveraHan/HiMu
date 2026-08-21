import { useState } from "react";
import { Pressable, View } from "react-native";
import { ImageOff, Loader, RefreshCw } from "lucide-react-native";

import {
  HimuImage,
  type HimuImageStatus,
} from "@/src/components/media/HimuImage";
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
  const [imageState, setImageState] = useState<{
    source: string | null;
    retryKey: number;
    status: HimuImageStatus;
  }>({
    source,
    retryKey,
    status: source ? "loading" : "idle",
  });
  const status =
    imageState.source === source && imageState.retryKey === retryKey
      ? imageState.status
      : source
        ? "loading"
        : "idle";

  const retry = () => {
    setRetryKey((key) => key + 1);
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
        onRetry={onRetry}
        onDisplay={onDisplay}
        onStatusChange={(nextStatus) => {
          setImageState({ source, retryKey, status: nextStatus });
        }}
        style={styles.frame}
        fallback={<View />}
      />
      {status === "loading" ? (
        <View
          accessible={false}
          pointerEvents="none"
          testID="player-artwork-loading"
          style={styles.fallback}
        >
          <Loader size={32} color={theme.colors.onSurfaceVariant} />
        </View>
      ) : null}
      {status === "error" || status === "idle" ? (
        <View
          accessible={false}
          pointerEvents="none"
          testID="player-artwork-fallback"
          style={styles.fallback}
        >
          <ImageOff size={36} color={theme.colors.onSurfaceVariant} />
          <Text variant="labelCaps" color="onSurfaceVariant">
            {t("playback.player.artwork.unavailable")}
          </Text>
        </View>
      ) : null}
      {source && status === "error" ? (
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
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
