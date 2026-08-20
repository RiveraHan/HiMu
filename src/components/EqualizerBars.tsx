import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";

type Props = {
  bars?: number;
  height?: number;
  color?: string;
};

function Bar({
  index,
  height,
  color,
}: {
  index: number;
  height: number;
  color: string;
}) {
  const scale = useSharedValue(0.3);

  useEffect(() => {
    scale.value = withDelay(
      index * 120,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 350 }),
          withTiming(0.25, { duration: 350 }),
        ),
        -1,
        true,
      ),
    );
  }, [index, scale]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));

  return (
    <Animated.View
      style={[styles.bar, { height, backgroundColor: color }, animated]}
    />
  );
}

export function EqualizerBars({ bars = 5, height = 20, color }: Props) {
  const { theme } = useUnistyles();
  const barColor = color ?? theme.colors.secondary;

  return (
    <View style={[styles.row, { height }]}>
      {Array.from({ length: bars }, (_, i) => (
        <Bar key={i} index={i} height={height} color={barColor} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  bar: {
    width: 3,
    borderRadius: theme.borderRadius.full,
  },
}));
