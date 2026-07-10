import { useToastStore, type ToastKind } from "@/src/stores/toast-store";
import { CircleAlert, Info, TriangleAlert, X } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  SlideInUp,
  SlideOutUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { scheduleOnRN } from "react-native-worklets";
import { GlassCard } from "./GlassCard";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

const AUTO_DISMISS_MS = 3500;
const SWIPE_DISMISS_THRESHOLD = -20;

const ICONS: Record<ToastKind, typeof Info> = {
  info: Info,
  warning: TriangleAlert,
  error: CircleAlert,
};

const COLOR_KEYS: Record<ToastKind, "primary" | "warning" | "error"> = {
  info: "primary",
  warning: "warning",
  error: "error",
};

export function ToastHost() {
  const current = useToastStore((s) => s.current);
  if (!current) return null;
  return (
    <ToastCard
      key={current.id}
      kind={current.kind}
      title={current.title}
      message={current.message}
    />
  );
}

function ToastCard({
  kind,
  title,
  message,
}: {
  kind: ToastKind;
  title: string;
  message?: string;
}) {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const dismiss = useToastStore((s) => s.dismiss);
  const translateY = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dismiss]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.min(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY < SWIPE_DISMISS_THRESHOLD) {
        scheduleOnRN(dismiss);
      } else {
        translateY.value = withTiming(0);
      }
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const Icon = ICONS[kind];
  const color = theme.colors[COLOR_KEYS[kind]];

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={SlideInUp.duration(300)}
        exiting={SlideOutUp.duration(200)}
        style={[
          styles.root,
          { top: insets.top + theme.spacing.stackSm },
          dragStyle,
        ]}
      >
        <Pressable
          onPress={dismiss}
          accessibilityRole="alert"
          style={styles.pressable}
        >
          <GlassCard level={3} style={styles.card}>
            <View style={[styles.chip, { borderColor: color }]}>
              <Icon size={20} color={color} />
            </View>
            <View style={styles.textWrap}>
              <Text variant="bodyMd" numberOfLines={1}>
                {title}
              </Text>
              {!!message && (
                <Text
                  variant="bodyMd"
                  color="onSurfaceVariant"
                  opacity={0.7}
                  numberOfLines={2}
                >
                  {message}
                </Text>
              )}
            </View>
            <IconButton
              icon={<X size={18} color={theme.colors.onSurfaceVariant} />}
              onPress={dismiss}
              size="sm"
              variant="plain"
              accessibilityLabel="Dismiss"
            />
          </GlassCard>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    position: "absolute",
    left: theme.spacing.pageMargin,
    right: theme.spacing.pageMargin,
    zIndex: 100,
  },
  pressable: {
    width: "100%",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.stackMd,
    padding: theme.spacing.stackMd,
  },
  chip: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.glassTint,
    borderWidth: StyleSheet.hairlineWidth,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
}));
