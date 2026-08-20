import { useWindowDimensions, View, type ViewProps } from "react-native";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import {
  canvasMaxWidth,
  resolveLayoutMode,
  type LayoutMode,
} from "@/src/theme/layout";

export type ScreenCanvasVariant = keyof typeof canvasMaxWidth;

type Props = ViewProps & {
  variant?: ScreenCanvasVariant;
};

export function ScreenCanvas({
  variant = "readable",
  style,
  ...rest
}: Props) {
  const { width } = useWindowDimensions();
  const { theme } = useUnistyles();
  const layoutMode: LayoutMode = resolveLayoutMode(width);
  const horizontalMargin =
    layoutMode === "compact" ? 0 : theme.spacing.pageMargin;

  return (
    <View
      {...rest}
      style={[
        styles.canvas,
        style,
        {
          marginHorizontal: horizontalMargin,
          maxWidth: canvasMaxWidth[variant],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create(() => ({
  canvas: {
    width: "100%",
    alignSelf: "center",
  },
}));
