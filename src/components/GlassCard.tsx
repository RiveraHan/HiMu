import { View, type ViewProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { GlassView } from './GlassView';

interface Props extends ViewProps {
  level?: 1 | 2 | 3;
}

export function GlassCard({ level = 2, style, children, ...props }: Props) {
  const tintStyle = level === 3 ? styles.cardStrong : styles.card;

  const card = (
    <GlassView level={level} style={[tintStyle, style]} {...props}>
      {children}
    </GlassView>
  );

  // Per design-system.md: only Elevation tier 2 (modals/overlays — our level 3) carries shadow.
  // Levels 1 & 2 rely on borders as "light catchers", no shadow.
  // The shadow lives on an outer wrapper so BlurView's overflow:'hidden' doesn't clip it.
  if (level < 3) return card;

  return <View style={styles.shadow}>{card}</View>;
}

const styles = StyleSheet.create((theme) => ({
  card: {
    padding: theme.spacing.cardPadding,
    backgroundColor: theme.colors.glassTint,
  },
  cardStrong: {
    padding: theme.spacing.cardPadding,
    backgroundColor: theme.colors.glassTintStrong,
  },
  shadow: {
    boxShadow: theme.shadows.modal,
  },
}));
