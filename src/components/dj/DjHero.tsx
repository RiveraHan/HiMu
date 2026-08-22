import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { HimuImage } from "../media/HimuImage";
import { Text } from "../Text";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react-native";

const HERO_HEIGHT = 380;

type Props = {
  name: string;
  avatarUrl?: string | null;
  isLive?: boolean;
  tagline?: string;
  testID?: string;
  isPrivate?: boolean;
  privateLabel?: string;
};

export function DjHero({
  name,
  avatarUrl,
  isLive,
  tagline,
  testID,
  isPrivate = false,
  privateLabel,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  return (
    <View
      accessible
      accessibilityLabel={[
        name,
        isLive ? t("dj.profile.live") : null,
        isPrivate ? privateLabel : null,
      ]
        .filter(Boolean)
        .join(", ")}
      testID={testID}
      style={styles.hero}
    >
      {avatarUrl ? (
        <HimuImage
          source={avatarUrl}
          style={styles.image}
          contentFit="cover"
          transition={200}
          eager
          fallback={<View style={[styles.image, styles.fallback]} />}
          componentLabel="DjHero artwork"
        />
      ) : (
        <View style={[styles.image, styles.fallback]} />
      )}

      <LinearGradient
        colors={["transparent", theme.colors.background]}
        style={styles.scrim}
      />

      <View style={styles.overlay}>
        <View style={styles.badges}>
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text variant="labelCaps" color="onSurface">
                {t("dj.profile.live")}
              </Text>
            </View>
          )}
          {!!tagline && (
            <Text variant="labelCaps" color="onSurfaceVariant">
              {tagline}
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
        </View>
        <Text variant="display">{name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  hero: {
    alignSelf: "stretch",
    height: HERO_HEIGHT,
    justifyContent: "flex-end",
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    borderCurve: "continuous",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  fallback: {
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    top: "35%",
  },
  overlay: {
    padding: theme.spacing.pageMargin,
    gap: theme.spacing.stackSm,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackXs,
    paddingHorizontal: theme.spacing.stackSm,
    paddingVertical: theme.spacing.stackXs,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.glassTintStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
  privateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackXs,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.error,
  },
}));
