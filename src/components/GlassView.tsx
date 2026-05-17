import { BlurView } from 'expo-blur';
import { Platform, type ViewProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface Props extends ViewProps {
  level?: 1 | 2 | 3;
}

// Android requires explicit blur method; iOS/Web work natively
const androidBlurProps =
  Platform.OS === 'android'
    ? {
        experimentalBlurMethod: 'dimezisBlurView' as const,
        blurReductionFactor: 4,
      }
    : undefined;

export function GlassView({
  level = 2,
  style,
  children,
  ...props
}: Props) {
  const intensity = level === 1 ? 40 : level === 2 ? 70 : 90;
  const levelStyle =
    level === 1 ? styles.level1 : level === 2 ? styles.level2 : styles.level3;

  return (
    <BlurView
      tint='systemMaterial'
      intensity={intensity}
      style={[styles.base, levelStyle, style]}
      {...androidBlurProps}
      {...props}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.glassBorder,
    borderCurve: 'continuous',
  },
  level1: { borderRadius: theme.borderRadius.lg },
  level2: { borderRadius: theme.borderRadius.xl },
  level3: { borderRadius: theme.borderRadius['2xl'] },
}));
