import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

import type { ActivityItem } from "@/src/activity/types";
import { Button } from "@/src/components/Button";
import { Text } from "@/src/components/Text";
import { activityStatusLabel } from "./ActivityPill";

type ActivityRowProps = {
  activity: ActivityItem;
  onOpen?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
  retrying?: boolean;
};

function openLabel(kind: ActivityItem["kind"], t: ReturnType<typeof useTranslation>["t"]): string {
  if (kind === "mix") return t("activity.openMix");
  if (kind === "cover") return t("activity.returnToPlayer");
  return t("activity.viewDj");
}

export function ActivityRow({
  activity,
  onOpen,
  onRetry,
  onDismiss,
  retrying = false,
}: ActivityRowProps) {
  const { t } = useTranslation();
  const failureCopy = activity.failureReason
    ? t(`activity.${activity.failureReason}`)
    : null;
  const detailCopy =
    activity.detail === "portraitUnavailable" ? t("activity.portraitUnavailable") : null;

  return (
    <View accessible={false} style={styles.row} testID="activity-row">
      <View style={styles.copy}>
        <Text selectable variant="bodyMd">
          {activityStatusLabel(activity, t)}
        </Text>
        {failureCopy ? (
          <Text selectable color="onSurfaceVariant" variant="bodyMd">
            {failureCopy}
          </Text>
        ) : null}
        {detailCopy ? (
          <Text selectable color="onSurfaceVariant" variant="bodyMd">
            {detailCopy}
          </Text>
        ) : null}
      </View>
      {onOpen || onRetry || onDismiss ? (
        <View style={styles.actions}>
          {onOpen ? (
            <Button label={openLabel(activity.kind, t)} onPress={onOpen} variant="ghost" />
          ) : null}
          {onRetry ? (
            <Button
              label={t("activity.retry")}
              loading={retrying}
              loadingLabel={t("activity.retrying")}
              onPress={onRetry}
              variant="ghost"
            />
          ) : null}
          {onDismiss ? (
            <Button label={t("activity.dismiss")} onPress={onDismiss} variant="ghost" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    gap: theme.spacing.stackMd,
    paddingVertical: theme.spacing.stackMd,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.outlineVariant,
  },
  copy: {
    gap: theme.spacing.stackXs,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing.stackSm,
  },
}));
