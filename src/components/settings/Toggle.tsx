import { Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 24;
const KNOB = 16;
const PAD = 4;
const TRAVEL = TRACK_WIDTH - KNOB - PAD * 2;

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
};

export function Toggle({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: Props) {
  const { theme } = useUnistyles();

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: withTiming(value ? TRAVEL : 0, { duration: 160 }) },
    ],
  }));

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      style={[
        styles.track,
        value ? styles.trackOn : styles.trackOff,
        disabled && styles.disabled,
      ]}
    >
      <Animated.View
        style={[
          styles.knob,
          {
            backgroundColor: value
              ? theme.colors.background
              : theme.colors.outline,
          },
          knobStyle,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: theme.borderRadius.full,
    flexDirection: "row",
    alignItems: "center",
    padding: PAD,
  },

  trackOn: {
    backgroundColor: theme.colors.primaryContainer,
    boxShadow: "0 0 15px rgba(129,140,248,0.3)",
  },
  trackOff: {
    backgroundColor: theme.colors.surfaceVariant,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: theme.borderRadius.full,
  },
  disabled: {
    opacity: 0.4,
  },
}));
