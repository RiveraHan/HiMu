import type { ReactNode } from "react";
import { Platform, useWindowDimensions, View } from "react-native";

import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";

import {
  formLayoutContract,
  responsiveFormStyle,
  resolveFormLayout,
} from "./form-layout";

type Props = {
  children: ReactNode;
};

/**
 * Keeps a review summary with the editor on desktop while preserving its
 * normal document position on compact and medium layouts.
 */
export function StickyReviewPanel({ children }: Props) {
  const { width, height } = useWindowDimensions();
  const { theme } = useUnistyles();
  const layout = resolveFormLayout({ width, height });
  const resolvedLayoutStyle = layout.lowHeight || Platform.OS === "web";

  return (
    <View
      testID="sticky-review-panel"
      style={[
        styles.panel as never,
        resolvedLayoutStyle
          ? {
              position: layout.reviewPosition,
              top: layout.useDocumentFlowActions ? 0 : theme.spacing.pageMargin,
              alignSelf: layout.useDocumentFlowActions ? "stretch" : "flex-start",
              width: layout.useDocumentFlowActions ? "100%" : 300,
            } as never
          : undefined,
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
