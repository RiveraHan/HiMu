import type { ReactNode } from "react";
import { View } from "react-native";

import { StyleSheet } from "@/src/theme/react-native-unistyles";

type Props = {
  children: ReactNode;
};

/**
 * Keeps a review summary with the editor on desktop while preserving its
 * normal document position on compact and medium layouts.
 */
export function StickyReviewPanel({ children }: Props) {
  return (
    <View testID="sticky-review-panel" style={styles.panel as never}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  panel: {
    position: { xs: "relative", xl: "sticky" } as never,
    top: { xs: 0, xl: theme.spacing.pageMargin },
    alignSelf: { xs: "stretch", xl: "flex-start" },
    width: { xs: "100%", xl: 300 },
    minWidth: 0,
  },
}));
