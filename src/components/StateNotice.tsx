import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { Button } from "./Button";
import { GlassCard } from "./GlassCard";
import { Text } from "./Text";

export type StateNoticeProps = {
  kind: "empty" | "error" | "offline";
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  testID?: string;
};

function announcementLabel(title: string, message?: string): string {
  return message ? `${title}. ${message}` : title;
}

export function StateNotice({
  kind,
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
  testID,
}: StateNoticeProps) {
  const copy = (
    <>
      <Text selectable variant="bodyMd">
        {title}
      </Text>
      {message ? (
        <Text selectable color="onSurfaceVariant" variant="bodyMd">
          {message}
        </Text>
      ) : null}
    </>
  );

  return (
    <GlassCard
      accessible={false}
      level={1}
      style={[styles.surface, compact && styles.compact]}
      testID={testID}
    >
      {kind === "empty" ? (
        <View style={styles.copy}>{copy}</View>
      ) : (
        <View
          accessible
          accessibilityLabel={announcementLabel(title, message)}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={styles.copy}
        >
          {copy}
        </View>
      )}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="ghost" />
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  surface: {
    gap: theme.spacing.stackMd,
    borderRadius: theme.borderRadius.lg,
    borderCurve: "continuous",
  },
  compact: {
    padding: 12,
    gap: theme.spacing.stackSm,
  },
  copy: {
    gap: theme.spacing.stackXs,
  },
}));
