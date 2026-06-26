import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";

export function FocusOrb({ active }: { active: boolean }) {
  const breath = useSharedValue(1);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (active && !reduced) {
      breath.value = withRepeat(
        withTiming(1.08, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      breath.value = withTiming(1, { duration: 600 });
    }
  }, [active, reduced, breath]);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
  }));
  const middleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
  }));

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.ringOuter, outerStyle]} />
      <Animated.View style={[styles.ringMiddle, middleStyle]} />
      <View style={styles.coreGlow} />
      <View style={styles.core}>
        <View style={styles.dot} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    width: 320,
    height: 320,
    alignItems: "center",
    justifyContent: "center",
  },
  ringOuter: {
    ...StyleSheet.absoluteFillObject,
    margin: 10,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(189,194,255,0.06)",
  },
  ringMiddle: {
    ...StyleSheet.absoluteFillObject,
    margin: 31,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: "rgba(189,194,255,0.10)",
  },
  coreGlow: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(129,140,248,0.10)",
  },
  core: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(42,41,47,0.40)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 30px rgba(0,0,0,0.5)",
    overflow: "hidden",
    borderCurve: "continuous",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(189,194,255,0.5)",
    boxShadow: theme.shadows.glow,
  },
}));
