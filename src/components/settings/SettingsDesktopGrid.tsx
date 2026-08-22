import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

type GridProps = Pick<ViewProps, "testID"> & {
  children: ReactNode;
};

type ItemProps = Pick<ViewProps, "testID"> & {
  children: ReactNode;
  size?: "standard" | "wide";
};

export function SettingsDesktopGrid({ children, testID }: GridProps) {
  return <View testID={testID} style={styles.grid}>{children}</View>;
}

export function SettingsDesktopGridItem({
  children,
  testID,
  size = "standard",
}: ItemProps) {
  return (
    <View
      testID={testID}
      style={[styles.item, size === "wide" && styles.wideItem]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  grid: {
    flexDirection: { xs: "column", xl: "row" },
    flexWrap: { xs: "nowrap", xl: "wrap" },
    alignItems: { xs: "stretch", xl: "flex-start" },
    gap: theme.spacing.stackLg,
    minWidth: 0,
  },
  item: {
    width: { xs: "100%", xl: "48%" },
    minWidth: 0,
  },
  wideItem: {
    width: { xs: "100%", xl: "100%" },
  },
}));
