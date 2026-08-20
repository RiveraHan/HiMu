import { useWindowDimensions, View, type ViewProps } from "react-native";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import {
  canvasMaxWidth,
  resolveLayoutMode,
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
  const layoutMode = resolveLayoutMode(width);
  const maxWidth =
    layoutMode === "compact" ? undefined : canvasMaxWidth[variant];

  return (
    <View
      {...rest}
      style={[
        styles.canvas,
        { paddingHorizontal: theme.spacing.pageMargin },
        style,
        { maxWidth },
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
