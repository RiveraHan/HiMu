import { Image } from "expo-image";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { Text } from "./Text";

type Props = {
  cover?: string | null;
  title: string;
  label: string;
  onPress?: () => void;
  right?: ReactNode;
  height?: number;
  testID?: string;
};

export function LibraryCard({
  cover,
  title,
  label,
  onPress,
  right,
  height = 180,
  testID,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.root,
        { height },
        pressed && styles.pressed,
      ]}
    >
      {cover ? (
        <Image
          source={cover}
          style={styles.cover}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.cover, styles.coverFallback]} />
      )}

      <View style={styles.overlay}>
        <Text variant="labelCaps" color="primary">
          {label}
        </Text>
        <View style={styles.bottom}>
          <Text variant="h2" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {right}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    borderRadius: theme.borderRadius.xl,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  cover: {
    ...StyleSheet.absoluteFillObject,
  },
  coverFallback: {
    backgroundColor: theme.colors.glassTint,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: theme.spacing.cardPadding,
    gap: theme.spacing.stackXs,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    flex: 1,
  },
}));
