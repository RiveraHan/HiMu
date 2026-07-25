import * as Haptics from "expo-haptics";
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
import { formatTime } from "@/src/utils/format-time";
import { useTranslation } from "react-i18next";

const KNOB = 16;
// Screen-reader adjustable actions seek in a predictable fixed interval.
const ACCESSIBILITY_SEEK_STEP_SECONDS = 10;

type Props = {
  positionSec: number;
  durationSec: number;
  onSeek: (seconds: number) => void;
};
export function SeekBar({ positionSec, durationSec, onSeek }: Props) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const scrubbing = useSharedValue(false);
  const scrubPosition = useSharedValue(0);
  // After the finger lifts, hold the knob at the released spot until the
  // reported position catches up to it — see the derived value below.
  const settling = useSharedValue(false);
  const settleTarget = useSharedValue(0);

  const pct = useDerivedValue(() => {
    if (scrubbing.value) return scrubPosition.value;

    const p = durationSec > 0 ? positionSec / durationSec : 0;

    // The seek is async: after release, positionSec keeps reporting the
    // pre-seek spot for up to one status tick (~500ms). Without this hold the
    // knob would animate back to the old spot and then jump forward once the
    // update lands. Keep it pinned at the released target until the reported
    // position reaches it, then resume normal tracking.
    if (settling.value) {
      if (Math.abs(p - settleTarget.value) < 0.02) {
        settling.value = false;
      } else {
        return settleTarget.value;
      }
    }

    return withTiming(p, {
      duration: 200,
      easing: Easing.out(Easing.ease),
    });
  }, [positionSec, durationSec]);

  const commitSeek = (p: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const seconds = p * durationSec;
    onSeek(seconds);
  };

  const seekByAccessibilityStep = (deltaSeconds: number) => {
    const maxSeconds = Math.max(durationSec, 0);
    onSeek(Math.min(Math.max(positionSec + deltaSeconds, 0), maxSeconds));
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
      settleTarget.value = scrubPosition.value;
      settling.value = true;
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
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t("playback.player.seek.label")}
        accessibilityHint={t("playback.player.seek.hint")}
        accessibilityActions={[
          {
            name: "increment",
            label: t("playback.player.seek.increment", {
              seconds: ACCESSIBILITY_SEEK_STEP_SECONDS,
            }),
          },
          {
            name: "decrement",
            label: t("playback.player.seek.decrement", {
              seconds: ACCESSIBILITY_SEEK_STEP_SECONDS,
            }),
          },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "increment") {
            seekByAccessibilityStep(ACCESSIBILITY_SEEK_STEP_SECONDS);
          } else if (event.nativeEvent.actionName === "decrement") {
            seekByAccessibilityStep(-ACCESSIBILITY_SEEK_STEP_SECONDS);
          }
        }}
        accessibilityValue={{
          min: 0,
          max: Math.max(durationSec, 0),
          now: Math.min(Math.max(positionSec, 0), Math.max(durationSec, 0)),
          text: t("playback.player.seek.value", {
            position: formatTime(positionSec),
            duration: formatTime(durationSec),
          }),
        }}
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
