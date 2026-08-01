import { IconButton } from "@/src/components/IconButton";
import { Text } from "@/src/components/Text";
import { router, type Href } from "expo-router";
import { ChevronLeft, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
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
    <View style={styles.root}>
      <View style={styles.row}>
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
        {actions && <View style={styles.actions}>{actions}</View>}
      </View>
      {(kicker || title || subtitle) && (
        <View style={styles.text}>
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
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.spacing.stackMd,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.stackSm,
  },
  text: {
    gap: theme.spacing.stackXs,
  },
}));
