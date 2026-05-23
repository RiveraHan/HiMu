import { useEffect, useMemo } from "react";
import { Dimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const PARTICLE_COUNT = 40;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface ParticleConfig {
  initialX: number;
  initialY: number;
  driftX: number;
  driftY: number;
  size: number;
  opacity: number;
  duration: number;
}

function Particle({
  initialX,
  initialY,
  driftX,
  driftY,
  size,
  opacity,
  duration,
}: ParticleConfig) {
  const x = useSharedValue(initialX);
  const y = useSharedValue(initialY);

  useEffect(() => {
    // Animate the particle to drift in a random direction and loop indefinitely
    x.value = withRepeat(
      withTiming(initialX + driftX, {
        duration,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    y.value = withRepeat(
      withTiming(initialY + driftY, {
        duration: duration * 1.3,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [duration, driftX, driftY, initialX, initialY, x, y]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `rgba(129, 140, 248, ${opacity})`,
        },
        animatedStyle,
      ]}
    />
  );
}

export function Atmosphere() {
  const particles = useMemo<ParticleConfig[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }, () => ({
        initialX: Math.random() * SCREEN_W,
        initialY: Math.random() * SCREEN_H,
        driftX: (Math.random() - 0.5) * 120, // ±60px
        driftY: (Math.random() - 0.5) * 120,
        size: Math.random() * 2.5 + 1.5, // 1.5–4px
        opacity: Math.random() * 0.5 + 0.15, // 0.15–0.65
        duration: 8000 + Math.random() * 8000, // 8–16s
      })),
    [],
  );

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {particles.map((particle, index) => (
        <Particle key={index} {...particle} />
      ))}
    </View>
  );
}
