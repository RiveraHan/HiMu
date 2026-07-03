import { Text } from "@/src/components/Text";
import Slider from "@react-native-community/slider";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type Props = {
  leftLabel: string;
  rightLabel: string;
  value: number;
  onCommit: (value: number) => void;
  disabled?: boolean;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
};

export function VibeSlider({
  leftLabel,
  rightLabel,
  value,
  onCommit,
  disabled,
  minimumValue = 0,
  maximumValue = 1,
  step,
}: Props) {
  const { theme } = useUnistyles();

  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);

  return (
    <View style={styles.wrap}>
      <Slider
        style={styles.slider}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        value={local}
        onValueChange={setLocal}
        onSlidingComplete={onCommit}
        minimumTrackTintColor={theme.colors.primaryContainer}
        maximumTrackTintColor={theme.colors.surfaceVariant}
        thumbTintColor={theme.colors.primary}
        disabled={disabled}
      />
      <View style={styles.labels}>
        <Text variant="labelCaps" color="onSurfaceVariant" opacity={0.7}>
          {leftLabel}
        </Text>
        <Text variant="labelCaps" color="onSurfaceVariant" opacity={0.7}>
          {rightLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    gap: theme.spacing.stackXs,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
}));
