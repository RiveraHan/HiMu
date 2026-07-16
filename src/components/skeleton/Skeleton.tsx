import { useEffect } from "react";
import type { DimensionValue, StyleProp, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

type Props = {
  width?: DimensionValue;
  height: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Skeleton({
  width = "100%",
  height,
  radius = 12,
  style,
  testID,
}: Props) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0.42);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.52;
      return;
    }

    opacity.value = withRepeat(withTiming(0.72, { duration: 900 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
      style={[
        styles.block,
        { width, height, borderRadius: radius },
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  block: {
    backgroundColor: theme.colors.surfaceContainerHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    overflow: "hidden",
  },
}));
