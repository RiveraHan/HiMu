import { Link, usePathname, type Href } from "expo-router";
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
import { useWebCorePresentation } from "@/src/components/web-core-presentation";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";

type RailItem = {
  href?: Href;
  icon: LucideIcon;
  label: string;
  area: DesktopRailArea;
  primary?: boolean;
  disabled?: boolean;
};

type DesktopRailArea = "home" | "discover" | "create" | "favorites" | "profile";

function isSingleDynamicChild(pathname: string, parent: string) {
  return new RegExp(`^${parent}/[^/]+$`).test(pathname);
}

export function resolveDesktopRailArea(pathname: string): DesktopRailArea | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (normalized === "/" || normalized === "/(app)") return "home";
  if (normalized === "/discover" || normalized === "/(app)/discover") {
    return "discover";
  }
  if (
    normalized === "/create-dj" ||
    normalized === "/create-track" ||
    isSingleDynamicChild(normalized, "/train-dj")
  ) {
    return "create";
  }
  if (normalized === "/favorites") return "favorites";
  if (
    normalized === "/profile" ||
    normalized === "/(app)/profile" ||
    normalized === "/account-settings" ||
    normalized === "/preferences" ||
    normalized === "/vibe-check"
  ) {
    return "profile";
  }

  return null;
}

export function DesktopRail({ ownedDjId }: { ownedDjId?: string | null }) {
  useWebCorePresentation("himu-web-core-presentation/desktop-rail");
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const activeArea = resolveDesktopRailArea(pathname);
  const [tooltipArea, setTooltipArea] = useState<DesktopRailArea | null>(null);
  const primaryItems: RailItem[] = [
    {
      href: "/(app)",
      icon: Home,
      label: t("common.navigation.home"),
      area: "home",
    },
    {
      href: "/(app)/discover",
      icon: Compass,
      label: t("common.navigation.discover"),
      area: "discover",
    },
  ];
  const createItem: RailItem = ownedDjId === undefined
    ? {
        icon: Sparkles,
        label: t("common.navigation.create"),
        area: "create",
        primary: true,
        disabled: true,
      }
    : ownedDjId
      ? {
        href: { pathname: "/create-track", params: { djId: ownedDjId } },
        icon: Sparkles,
        label: t("common.navigation.createTrack"),
        area: "create",
        primary: true,
        }
      : {
        href: "/create-dj",
        icon: Sparkles,
        label: t("dj.create.title"),
        area: "create",
        primary: true,
        };
  const utilityItems: RailItem[] = [
    {
      href: "/favorites",
      icon: Heart,
      label: t("profile.favorites.title"),
      area: "favorites",
    },
    {
      href: "/(app)/profile",
      icon: User,
      label: t("common.navigation.profile"),
      area: "profile",
    },
  ];

  const renderItem = ({ href, icon: Icon, label, area, primary, disabled }: RailItem) => {
    const active = activeArea === area;
    const tooltipVisible = tooltipArea === area;
    const control = (
      <Pressable
        accessibilityHint={label}
        accessibilityLabel={label}
        accessibilityRole={disabled ? "button" : "link"}
        accessibilityState={disabled ? { disabled: true } : undefined}
        aria-current={!disabled && active ? "page" : undefined}
        disabled={disabled}
        onBlur={() => setTooltipArea(null)}
        onFocus={() => setTooltipArea(area)}
        onHoverIn={() => setTooltipArea(area)}
        onHoverOut={() => setTooltipArea(null)}
        style={({ pressed }) => [
          styles.item,
          primary && styles.primaryItem,
          active && styles.itemActive,
          tooltipVisible && styles.itemFocused,
          disabled && styles.itemDisabled,
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
      </Pressable>
    );

    return (
      <View key={area} style={styles.itemWrap}>
        {href ? <Link href={href} asChild>{control}</Link> : control}
        {tooltipVisible ? (
          <View
            pointerEvents="none"
            style={styles.tooltip}
            testID={`desktop-rail-tooltip-${area}`}
          >
            <Text variant="labelCaps" numberOfLines={1}>{label}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View
      accessibilityLabel="Main navigation"
      style={[
        styles.root,
        {
          width: insets.left + DESKTOP_RAIL_WIDTH,
          paddingLeft: insets.left + theme.spacing.stackMd,
          paddingTop: insets.top + theme.spacing.stackLg,
          paddingBottom: insets.bottom + theme.spacing.stackLg,
        },
      ]}
      testID="desktop-rail"
    >
      <View style={styles.topGroups}>
        <View style={styles.items} testID="desktop-rail-primary-links">
          {primaryItems.map(renderItem)}
        </View>
        <View testID="desktop-rail-create-action">
          {renderItem(createItem)}
        </View>
      </View>
      <View style={styles.items} testID="desktop-rail-utility-links">
        {utilityItems.map(renderItem)}
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
    paddingRight: theme.spacing.stackMd,
    justifyContent: "space-between",
    backgroundColor: theme.colors.background,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.colors.glassBorder,
  },
  items: {
    gap: theme.spacing.stackSm,
  },
  topGroups: {
    gap: theme.spacing.stackLg,
  },
  item: {
    width: 56,
    height: 56,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
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
  itemDisabled: {
    opacity: 0.45,
  },
  itemWrap: {
    position: "relative",
  },
  tooltip: {
    position: "absolute",
    left: 72,
    top: 8,
    zIndex: 1,
    paddingHorizontal: theme.spacing.stackSm,
    paddingVertical: theme.spacing.stackXs,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
}));
