import { usePathname, useRouter } from "expo-router";
import {
  Compass,
  Heart,
  Home,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { DESKTOP_RAIL_WIDTH } from "@/src/components/bottom-chrome-metrics";
import { Text } from "@/src/components/Text";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";

type RailItem = {
  href: "/(app)" | "/(app)/discover" | "/create-dj" | "/favorites" | "/(app)/profile";
  icon: LucideIcon;
  label: string;
  matches: (pathname: string) => boolean;
  primary?: boolean;
};

function pathnameMatches(pathname: string, paths: string[]) {
  return paths.includes(pathname);
}

export function DesktopRail() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const [focusedHref, setFocusedHref] = useState<string | null>(null);
  const items: RailItem[] = [
    {
      href: "/(app)",
      icon: Home,
      label: t("common.navigation.home"),
      matches: (path) => pathnameMatches(path, ["/", "/(app)"]),
    },
    {
      href: "/(app)/discover",
      icon: Compass,
      label: t("common.navigation.discover"),
      matches: (path) => pathnameMatches(path, ["/discover", "/(app)/discover"]),
    },
    {
      href: "/create-dj",
      icon: Sparkles,
      label: t("dj.create.title"),
      matches: (path) => pathnameMatches(path, ["/create-dj"]),
      primary: true,
    },
    {
      href: "/favorites",
      icon: Heart,
      label: t("profile.favorites.title"),
      matches: (path) => pathnameMatches(path, ["/favorites"]),
    },
    {
      href: "/(app)/profile",
      icon: User,
      label: t("common.navigation.profile"),
      matches: (path) => pathnameMatches(path, ["/profile", "/(app)/profile"]),
    },
  ];

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.root, { paddingTop: insets.top + theme.spacing.stackLg }]}
      testID="desktop-rail"
    >
      <View style={styles.items}>
        {items.map(({ href, icon: Icon, label, matches, primary }) => {
          const active = matches(pathname);
          const focused = focusedHref === href;

          return (
            <Pressable
              key={href}
              accessibilityHint={label}
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onBlur={() => setFocusedHref(null)}
              onFocus={() => setFocusedHref(href)}
              onPress={() => router.navigate(href)}
              style={({ pressed }) => [
                styles.item,
                primary && styles.primaryItem,
                active && styles.itemActive,
                focused && styles.itemFocused,
                pressed && styles.itemPressed,
              ]}
            >
              <Icon
                color={
                  primary || active
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
                size={22}
              />
              <Text
                variant="labelCaps"
                color={primary || active ? "primary" : "onSurfaceVariant"}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    position: "absolute",
    zIndex: 30,
    top: 0,
    bottom: 0,
    left: 0,
    width: DESKTOP_RAIL_WIDTH,
    paddingHorizontal: theme.spacing.stackMd,
    backgroundColor: theme.colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.colors.glassBorder,
  },
  items: {
    gap: theme.spacing.stackSm,
  },
  item: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: theme.spacing.stackMd,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackSm,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: "transparent",
  },
  primaryItem: {
    backgroundColor: theme.colors.primaryContainer,
  },
  itemActive: {
    backgroundColor: theme.colors.glassTint,
  },
  itemFocused: {
    borderColor: theme.colors.primary,
  },
  itemPressed: {
    opacity: 0.78,
  },
}));
