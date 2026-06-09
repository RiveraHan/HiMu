import { useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { scheduleOnRN } from "react-native-worklets";

const KNOB = 16;

type Props = {
  positionSec: number;
  durationSec: number;
  onSeek: (seconds: number) => void;
};
export function SeekBar({ positionSec, durationSec, onSeek }: Props) {
  const [width, setWidth] = useState(0);
  const scrubbing = useSharedValue(false);
  const scrubPosition = useSharedValue(0);

  const pct = useDerivedValue(() => {
    if (scrubbing.value) return scrubPosition.value;

    const p = durationSec > 0 ? positionSec / durationSec : 0;

    return withTiming(p, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });
  }, [positionSec, durationSec]);

  const commitSeek = (p: number) => {
    const seconds = p * durationSec;
    onSeek(seconds);
  };

  const pan = Gesture.Pan()
    .onBegin((e) => {
      scrubbing.value = true;
      scrubPosition.value =
        width > 0 ? Math.min(Math.max(e.x / width, 0), 1) : 0;
    })
    .onUpdate((e) => {
      scrubPosition.value =
        width > 0 ? Math.min(Math.max(e.x / width, 0), 1) : 0;
    })
    .onEnd(() => {
      scheduleOnRN(commitSeek, scrubPosition.value);
      scrubbing.value = false;
    });

  const fillStyle = useAnimatedStyle(() => ({
    width: `${pct.value * 100}%`,
  }));

  const knobStyle = useAnimatedStyle(() => ({
    left: `${pct.value * 100}%`,
  }));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.hitbox}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
        <Animated.View style={[styles.knob, knobStyle]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create((theme) => ({
  hitbox: {
    height: 24,
    justifyContent: "center",
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  knob: {
    position: "absolute",
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    marginLeft: -KNOB / 2, // to center the knob on the track
    backgroundColor: theme.colors.primary,
    ...(process.env.EXPO_OS === "ios"
      ? { boxShadow: "0 0 12px rgba(189,194,255,0.6)" }
      : { elevation: 6 }),
  },
}));
