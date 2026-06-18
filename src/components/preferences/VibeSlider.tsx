import { Text } from "@/src/components/Text";
import Slider from "@react-native-community/slider";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

type Props = {
  leftLabel: number;
  rightLabel: number;
  value: number;
  onCommit: (value: number) => void;
  disabled?: boolean;
};

export function VibeSlider({
  leftLabel,
  rightLabel,
  value,
  onCommit,
  disabled,
}: Props) {
  const { theme } = useUnistyles();

  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);

  return (
    <View style={styles.wrap}>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        value={local}
        onValueChange={setLocal}
        onSlidingComplete={onCommit}
        minimumTrackTintColor={theme.colors.primaryContainer}
        maximumTrackTintColor={theme.colors.surfaceVariant}
        thumbTintColor={theme.colors.primary}
        disabled={disabled}
      />
      <View style={styles.labels}>
        <Text variant="labelCaps" color="onSurfaceVariant">
          {leftLabel}
        </Text>
        <Text variant="labelCaps" color="onSurfaceVariant">
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
