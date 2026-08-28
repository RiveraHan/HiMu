import { forwardRef } from "react";
import { Text as RNText, type TextProps } from "react-native";
import { useUnistyles } from "@/src/theme/react-native-unistyles";

type Variant = "display" | "h1" | "h2" | "bodyLg" | "bodyMd" | "labelCaps";

interface Props extends TextProps {
  variant?: Variant;
  color?: keyof ReturnType<typeof useUnistyles>["theme"]["colors"];
  opacity?: number;
}

export const Text = forwardRef<RNText, Props>(function Text({
  variant = "bodyMd",
  color = "onSurface",
  opacity,
  style,
  ...props
}: Props, ref) {
  const { theme } = useUnistyles();

  return (
    <RNText
      ref={ref}
      style={[
        theme.typography[variant],
        { color: theme.colors[color], opacity },
        style,
      ]}
      {...props}
    />
  );
});
