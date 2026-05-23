import { Text as RNText, type TextProps } from "react-native";
import { useUnistyles } from "react-native-unistyles";

type Variant = "display" | "h1" | "h2" | "bodyLg" | "bodyMd" | "labelCaps";

interface Props extends TextProps {
  variant?: Variant;
  color?: keyof ReturnType<typeof useUnistyles>["theme"]["colors"];
  opacity?: number;
}

export function Text({
  variant = "bodyMd",
  color = "onSurface",
  opacity,
  style,
  ...props
}: Props) {
  const { theme } = useUnistyles();

  return (
    <RNText
      style={[
        theme.typography[variant],
        { color: theme.colors[color], opacity },
        style,
      ]}
      {...props}
    />
  );
}
