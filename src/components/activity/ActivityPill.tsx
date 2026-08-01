import { useEffect } from "react";
import { Check, CircleAlert, Loader } from "lucide-react-native";
import { Pressable, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { useActivity } from "@/src/activity";
import type { ActivityItem } from "@/src/activity/types";
import { Text } from "@/src/components/Text";

export type ActivityPillProps = {
  activity: ActivityItem | null;
  activeCount: number;
  fallbackStatus?: "loading" | "offline" | "error";
};

export function activityStatusLabel(activity: ActivityItem, t: TFunction): string {
  if (activity.kind === "mix") {
    if (activity.status === "ready") return t("activity.mixReady");
    if (activity.status === "failed") return t("activity.mixFailed");
    if (activity.status === "slow") {
      return t("activity.mixSlow", { name: activity.title });
    }
    return t(
      activity.status === "queued" ? "activity.mixQueued" : "activity.mixRunning",
      { name: activity.title },
    );
  }
  if (activity.status === "failed") {
    const key = {
      "create-dj": "createDjFailed",
      "update-dj": "updateDjFailed",
      cover: "coverFailed",
    }[activity.kind];
    return t(`activity.${key}`, { name: activity.title });
  }
  if (activity.status === "queued") return t("activity.queued");
  if (activity.status === "slow") return t("activity.slow");
  const phase = activity.status === "ready" ? "Ready" : "Running";
  const prefix = {
    "create-dj": "createDj",
    "update-dj": "updateDj",
    cover: "cover",
  }[activity.kind];
  const key = `${prefix}${phase}` as
    | "createDjRunning"
    | "createDjReady"
    | "updateDjRunning"
    | "updateDjReady"
    | "coverRunning"
    | "coverReady";
  return t(`activity.${key}`, { name: activity.title });
}

function StatusIcon({
  activity,
  fallbackStatus,
}: Pick<ActivityPillProps, "activity" | "fallbackStatus">) {
  const { theme } = useUnistyles();
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const active =
    activity !== null &&
    (activity.status === "queued" ||
      activity.status === "running" ||
      activity.status === "slow");

  useEffect(() => {
    if (active && !reduceMotion) {
      rotation.value = 0;
      rotation.value = withRepeat(withTiming(360, { duration: 1200 }), -1, false);
    } else {
      cancelAnimation(rotation);
      rotation.value = 0;
    }
    return () => cancelAnimation(rotation);
  }, [active, reduceMotion, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const failed =
    activity?.status === "failed" || fallbackStatus === "error" || fallbackStatus === "offline";
  const color =
    activity?.status === "failed" || fallbackStatus === "error"
      ? theme.colors.error
      : activity?.status === "ready"
        ? theme.colors.tertiary
        : theme.colors.primary;

  if (activity?.status === "ready") return <Check color={color} size={18} />;
  if (failed) return <CircleAlert color={color} size={18} />;
  return (
    <Animated.View style={animatedStyle}>
      <Loader color={color} size={18} />
    </Animated.View>
  );
}

export function ActivityPill({ activity, activeCount, fallbackStatus }: ActivityPillProps) {
  const { t } = useTranslation();
  const { openPanel } = useActivity();
  const statusLabel = activity
    ? activityStatusLabel(activity, t)
    : t(
        fallbackStatus === "offline"
          ? "activity.offline"
          : fallbackStatus === "error"
            ? "activity.unavailable"
            : "activity.loading",
      );
  const terminal = activity?.status === "ready" || activity?.status === "failed";
  const label =
    terminal && activeCount > 0
      ? t("activity.withActiveCount", { status: statusLabel, count: activeCount })
      : !terminal && activeCount > 1
        ? t("activity.activeCount", { count: activeCount })
        : statusLabel;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={openPanel}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <View accessible={false} style={styles.icon}>
        <StatusIcon activity={activity} fallbackStatus={fallbackStatus} />
      </View>
      <Text numberOfLines={1} variant="bodyMd">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  pill: {
    minHeight: 48,
    maxWidth: 300,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackSm,
    paddingHorizontal: theme.spacing.gutter,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.glassTintStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
  icon: {
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
}));
