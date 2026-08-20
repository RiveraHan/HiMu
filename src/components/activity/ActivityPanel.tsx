import { useEffect, useRef } from "react";
import { X } from "lucide-react-native";
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";

import { useActivity } from "@/src/activity";
import { IconButton } from "@/src/components/IconButton";
import { StateNotice } from "@/src/components/StateNotice";
import { Text } from "@/src/components/Text";
import { ActivityRow } from "./ActivityRow";

export function ActivityPanel() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const headingRef = useRef<View>(null);
  const {
    items,
    isInitialLoading,
    isOffline,
    queryError,
    panelOpen,
    closePanel,
    refetch,
    markSeen,
    canOpenActivity,
    openActivity,
    retryActivity,
    retryingIds,
  } = useActivity();

  useEffect(() => {
    if (!panelOpen) return;
    const title = t("activity.panelTitle");
    AccessibilityInfo.announceForAccessibility(title);
    const node = findNodeHandle(headingRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [panelOpen, t]);

  const stateKind = queryError ? "error" : isOffline ? "offline" : null;
  const stateTitle = queryError
    ? t("activity.unavailable")
    : isOffline
      ? t("activity.offline")
      : null;

  return (
    <Modal
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={closePanel}
      testID="activity-modal"
      transparent
      visible={panelOpen}
    >
      <View
        accessibilityViewIsModal
        style={[
          styles.backdrop,
          {
            paddingTop: insets.top + theme.spacing.gutter,
            paddingRight: insets.right + theme.spacing.gutter,
            paddingBottom: insets.bottom + theme.spacing.gutter,
            paddingLeft: insets.left + theme.spacing.gutter,
          },
        ]}
        testID="activity-panel"
      >
        <Pressable
          accessible={false}
          onPress={closePanel}
          style={StyleSheet.absoluteFill}
          testID="activity-backdrop"
        />
        <View
          style={[styles.panel, { maxHeight: height * 0.7 }]}
          testID="activity-panel-surface"
        >
          <View style={styles.headingRow}>
            <View
              ref={headingRef}
              accessible
              accessibilityLabel={t("activity.panelTitle")}
              accessibilityRole="header"
              focusable
            >
              <Text variant="h2">{t("activity.panelTitle")}</Text>
            </View>
            <IconButton
              accessibilityLabel={t("activity.closePanel")}
              icon={<X color={theme.colors.onSurfaceVariant} size={20} />}
              onPress={closePanel}
            />
          </View>
          <ScrollView
            contentContainerStyle={styles.listContainer}
            style={styles.list}
            testID="activity-list"
          >
            <View
              style={[styles.listContent, { paddingBottom: insets.bottom + theme.spacing.gutter }]}
              testID="activity-list-content"
            >
              {stateKind && stateTitle ? (
                <StateNotice
                  actionLabel={queryError ? t("activity.retry") : undefined}
                  compact={items.length > 0}
                  kind={stateKind}
                  onAction={queryError ? () => void refetch() : undefined}
                  testID="activity-state-notice"
                  title={stateTitle}
                />
              ) : null}
              {isInitialLoading && items.length === 0 && !stateKind ? (
                <ActivityIndicator
                  accessibilityLabel={t("activity.loading")}
                  color={theme.colors.primary}
                  testID="activity-loading"
                />
              ) : null}
              {!isInitialLoading && !stateKind && items.length === 0 ? (
                <StateNotice kind="empty" title={t("activity.empty")} />
              ) : null}
              {items.map((item) => {
                const canOpen = canOpenActivity(item);
                const terminal = item.status === "ready" || item.status === "failed";
                return (
                  <ActivityRow
                    key={item.id}
                    activity={item}
                    onDismiss={
                      !canOpen && terminal ? () => void markSeen(item) : undefined
                    }
                    onOpen={canOpen ? () => void openActivity(item) : undefined}
                    onRetry={
                      item.source === "server" &&
                      (item.status === "failed" || item.recoveryAvailable)
                        ? () => void retryActivity(item)
                        : undefined
                    }
                    retrying={retryingIds.has(item.id)}
                  />
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  panel: {
    width: "100%",
    maxWidth: 520,
    overflow: "hidden",
    borderRadius: theme.borderRadius.xl,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.surfaceContainer,
    boxShadow: theme.shadows.modal,
  },
  headingRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.stackMd,
    paddingHorizontal: theme.spacing.cardPadding,
    paddingVertical: theme.spacing.stackSm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.outlineVariant,
  },
  list: {
    flexShrink: 1,
  },
  listContainer: {
    flexGrow: 0,
  },
  listContent: {
    gap: theme.spacing.stackSm,
    paddingTop: theme.spacing.stackSm,
    paddingHorizontal: theme.spacing.cardPadding,
  },
}));
