import { View, type StyleProp, type ViewStyle } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { HimuImage } from "./media/HimuImage";
import { Text } from "./Text";

const SIZES = { xs: 24, sm: 32, md: 48, lg: 64, xl: 96, "2xl": 128 } as const;

type Props = {
  src?: string | null;
  size?: keyof typeof SIZES;
  desktopSize?: keyof typeof SIZES;
  fallback: string;
  testID?: string;
  eager?: boolean;
};

export function Avatar({
  src,
  size = "md",
  desktopSize,
  fallback,
  testID,
  eager = false,
}: Props) {
  const dimension = SIZES[size];
  const frameStyle = styles.frame(
    dimension,
    desktopSize ? SIZES[desktopSize] : undefined,
  ) as StyleProp<ViewStyle>;

  return (
    <HimuImage
      source={src}
      fallback={
        <View
          style={[
            styles.fallback,
            frameStyle,
          ]}
        >
          <Text
            variant={
              size === "2xl" || size === "xl"
                ? "h1"
                : size === "lg"
                  ? "h2"
                  : "bodyMd"
            }
            color="onPrimaryContainer"
          >
            {fallback.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      }
      style={[
        styles.img,
        frameStyle,
      ]}
      contentFit="cover"
      transition={200}
      eager={eager}
      componentLabel="Avatar"
      testID={testID}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  frame: (size: number, desktopSize?: number) => ({
    width: desktopSize ? { xs: size, xl: desktopSize } : size,
    height: desktopSize ? { xs: size, xl: desktopSize } : size,
  }),
  img: {
    borderRadius: theme.borderRadius.full,
  },
  fallback: {
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
}));
