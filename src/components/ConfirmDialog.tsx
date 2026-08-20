import { useConfirmStore } from "@/src/stores/confirm-store";
import { useEffect } from "react";
import { BackHandler, Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { GlassCard } from "./GlassCard";
import { Text } from "./Text";

export function ConfirmDialogHost() {
  const { t } = useTranslation();
  const pending = useConfirmStore((s) => s.pending);
  const resolve = useConfirmStore((s) => s.resolve);
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();

  useEffect(() => {
    if (!pending) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      resolve(false);
      return true;
    });
    return () => sub.remove();
  }, [pending, resolve]);

  if (!pending) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={[
        styles.backdrop,
        {
          paddingTop: insets.top + theme.spacing.pageMargin,
          paddingBottom: insets.bottom + theme.spacing.pageMargin,
        },
      ]}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => resolve(false)}
        accessibilityRole="button"
        accessibilityLabel={t("common.actions.dismiss")}
      />
      <Animated.View
        entering={ZoomIn.duration(200)}
        exiting={ZoomOut.duration(150)}
        style={styles.panelWrap}
      >
        <GlassCard level={3} style={styles.panel}>
          <Text variant="h2">{pending.title}</Text>
          {!!pending.message && (
            <Text variant="bodyMd" color="onSurfaceVariant" opacity={0.8}>
              {pending.message}
            </Text>
          )}
          <View style={styles.actions}>
            <Button
              variant="glass"
              label={pending.cancelLabel ?? t("common.actions.cancel")}
              onPress={() => resolve(false)}
              style={styles.actionButton}
            />
            <Button
              variant="primary"
              destructive={pending.destructive}
              label={pending.confirmLabel ?? t("common.actions.confirm")}
              onPress={() => resolve(true)}
              style={styles.actionButton}
            />
          </View>
        </GlassCard>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: theme.spacing.pageMargin,
    zIndex: 200,
  },
  panelWrap: {
    width: "100%",
    maxWidth: 340,
  },
  panel: {
    gap: theme.spacing.stackMd,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.stackSm,
  },
  actionButton: {
    flex: 1,
  },
}));
