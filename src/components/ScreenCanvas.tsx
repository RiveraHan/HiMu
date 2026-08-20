import { View, type ViewProps } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { canvasMaxWidth } from "@/src/theme/layout";

export type ScreenCanvasVariant = keyof typeof canvasMaxWidth;

type Props = ViewProps & {
  variant?: ScreenCanvasVariant;
};

export function ScreenCanvas({
  variant = "readable",
  style,
  ...rest
}: Props) {
  return (
    <View
      {...rest}
      style={[
        styles.canvas(canvasMaxWidth[variant]),
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  canvas: (maxWidth: number) => ({
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: theme.spacing.pageMargin,
    maxWidth: { xs: undefined, lg: maxWidth },
  }),
}));
