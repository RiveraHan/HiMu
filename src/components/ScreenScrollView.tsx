import type { ReactNode } from "react";
import {
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { StatusBarScrim } from "./StatusBarScrim";

type Props = Omit<ScrollViewProps, "onScroll"> & {
  children: ReactNode;
  /** Style for the outer container — the screen background lives here. */
  style?: StyleProp<ViewStyle>;
  onScrollRef?: (node: { scrollTo(options: { y: number; animated: boolean }): void } | null) => void;
};

// A vertical ScrollView with the status-bar scrim baked in: content stays
// edge-to-edge at the top and fades behind the OS status bar as it scrolls up,
// so it never collides with the battery/wifi icons. Drop-in replacement for a
// screen's root `<View style={root}><ScrollView …>` pairing — pass the screen
// background via `style` and the usual `contentContainerStyle` for padding.
export function ScreenScrollView({
  children,
  style,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
  onScrollRef,
  ...rest
}: Props) {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  return (
    <View style={[styles.root, style]}>
      <Animated.ScrollView
        {...rest}
        ref={onScrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        contentContainerStyle={[contentContainerStyle, styles.centeredContent]}
      >
        {children}
      </Animated.ScrollView>
      <StatusBarScrim scrollY={scrollY} />
    </View>
  );
}

const styles = StyleSheet.create(() => ({
  root: { flex: 1 },
  centeredContent: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
}));
