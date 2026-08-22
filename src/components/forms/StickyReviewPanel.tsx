import type { ReactNode } from "react";
import { Platform, useWindowDimensions, View } from "react-native";

import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";

import {
  formLayoutContract,
  responsiveFormStyle,
  resolveResponsiveFormStyle,
} from "./form-layout";

type Props = {
  children: ReactNode;
};

/**
 * Keeps a review summary with the editor on desktop while preserving its
 * normal document position on compact and medium layouts.
 */
export function StickyReviewPanel({ children }: Props) {
  const { width } = useWindowDimensions();
  const { theme } = useUnistyles();

  return (
    <View
      testID="sticky-review-panel"
      style={[
        styles.panel as never,
        Platform.OS === "web" ? {
          position: resolveResponsiveFormStyle(
            formLayoutContract.reviewPosition,
            width,
          ),
          top: resolveResponsiveFormStyle(
            responsiveFormStyle(0, theme.spacing.pageMargin),
            width,
          ),
          alignSelf: resolveResponsiveFormStyle(
            responsiveFormStyle("stretch", "flex-start"),
            width,
          ),
          width: resolveResponsiveFormStyle(responsiveFormStyle("100%", 300), width),
        } as never : undefined,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  panel: {
    position: formLayoutContract.reviewPosition as never,
    top: responsiveFormStyle(0, theme.spacing.pageMargin),
    alignSelf: responsiveFormStyle("stretch", "flex-start"),
    width: responsiveFormStyle("100%", 300),
    minWidth: 0,
  },
}));
