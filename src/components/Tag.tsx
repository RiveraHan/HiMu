import { Text } from "@/src/components/Text";
import { View } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

type Props = {
  label: string;
};

export function Tag({ label }: Props) {
  return (
    <View style={styles.tag}>
      <Text variant="labelCaps" color="onSurfaceVariant">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  tag: {
    paddingHorizontal: theme.spacing.stackMd - 2,
    paddingVertical: theme.spacing.stackSm,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.surfaceContainerHigh,
    borderCurve: "continuous",
  },
}));
