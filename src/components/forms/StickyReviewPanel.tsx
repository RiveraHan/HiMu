import type { ReactNode } from "react";
import { View } from "react-native";

import { StyleSheet } from "@/src/theme/react-native-unistyles";

import { formLayout, responsiveFormStyle } from "./form-layout";

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
    position: responsiveFormStyle(
      formLayout.compact.reviewPosition,
      formLayout.desktop.reviewPosition,
    ) as never,
    top: responsiveFormStyle(0, theme.spacing.pageMargin),
    alignSelf: responsiveFormStyle("stretch", "flex-start"),
    width: responsiveFormStyle("100%", 300),
    minWidth: 0,
  },
}));
