import { IconButton } from "@/src/components/IconButton";
import { Text } from "@/src/components/Text";
import { router, type Href } from "expo-router";
import { ChevronLeft, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";

type Props = {
  variant?: "back" | "close";
  onLeftPress?: () => void;
  kicker?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  disabled?: boolean;
  fallbackHref?: Href;
};

export function ScreenHeader({
  variant = "back",
  onLeftPress,
  kicker,
  title,
  subtitle,
  actions,
  disabled = false,
  fallbackHref = "/",
}: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const Icon = variant === "back" ? ChevronLeft : X;
  const handleLeftPress = () => {
    if (onLeftPress) {
      onLeftPress();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackHref);
    }
  };

  return (
    <View style={styles.root} testID="screen-header">
      <View style={styles.leading} testID="screen-header-leading">
        <IconButton
          variant="glass"
          icon={<Icon size={24} color={theme.colors.onSurface} />}
          onPress={handleLeftPress}
          disabled={disabled}
          accessibilityLabel={
            variant === "back"
              ? t("common.actions.back")
              : t("common.actions.close")
          }
        />
      </View>
      {(kicker || title || subtitle) && (
        <View style={styles.text} testID="screen-header-copy">
          {!!kicker && (
            <Text variant="labelCaps" color="outline">
              {kicker}
            </Text>
          )}
          {!!title && <Text variant="h1">{title}</Text>}
          {!!subtitle && (
            <Text variant="bodyMd" color="onSurfaceVariant">
              {subtitle}
            </Text>
          )}
        </View>
      )}
      {actions ? (
        <View style={styles.actions} testID="screen-header-actions">
          {actions}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.spacing.stackMd,
  },
  leading: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    alignSelf: "stretch",
    maxWidth: "100%",
    minWidth: 0,
    gap: theme.spacing.stackSm,
  },
  text: {
    gap: theme.spacing.stackXs,
    minWidth: 0,
    maxWidth: "100%",
    flexShrink: 1,
  },
}));
