import { BlurView } from "expo-blur";
import { View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet } from "react-native-unistyles";

// Masks content that scrolls up behind the translucent OS status bar. Fully
// transparent at the top of the scroll (clean, edge-to-edge) and fades in as
// the user scrolls down, so titles/covers never collide with the battery/wifi
// icons. Driven by the host screen's scroll offset. iOS gets a blur (matching
// the tab bar); Android falls back to a solid background fill.
export function StatusBarScrim({ scrollY }: { scrollY: SharedValue<number> }) {
  const insets = useSafeAreaInsets();

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 48], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.root, { height: insets.top }, style]}
    >
      {process.env.EXPO_OS === "ios" ? (
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={styles.androidFill} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  androidFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
  },
}));
