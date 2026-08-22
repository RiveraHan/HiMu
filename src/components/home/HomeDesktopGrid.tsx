import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { useWebCorePresentation } from "@/src/components/web-core-presentation";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

type Props = {
  children: ReactNode;
};

type Slot = "hero" | "djs" | "shelves" | "lower" | "library" | "supporting";

type SlotProps = {
  slot: Slot;
  children: ReactNode;
};

type OffsetTargetProps = {
  children: (onLayout: (event: LayoutChangeEvent) => void) => ReactNode;
  onOffset: (offset: number) => void;
};

const HomeDesktopGridOffsetContext = createContext<number | null>(null);

/**
 * Keeps Home's content in its reading order while CSS breakpoints compose the
 * wide canvas. Data, playback, tour targets, and failure states remain owned
 * by HomeScreen.
 */
export function HomeDesktopGrid({
  children,
}: Props) {
  useWebCorePresentation("himu-web-core-presentation/home-grid");
  const [localOffset, setLocalOffset] = useState<number | null>(null);
  return (
    <View
      testID="home-desktop-grid"
      style={styles.root}
      onLayout={(event) => setLocalOffset(event.nativeEvent.layout.y)}
    >
      <HomeDesktopGridOffsetContext value={localOffset}>
        {children}
      </HomeDesktopGridOffsetContext>
    </View>
  );
}

export function HomeDesktopGridSlot({ slot, children }: SlotProps) {
  const parentOffset = useContext(HomeDesktopGridOffsetContext);
  const [localOffset, setLocalOffset] = useState<number | null>(null);
  const contentOffset =
    parentOffset === null || localOffset === null
      ? null
      : parentOffset + localOffset;

  return (
    <View
      testID={slot === "hero" ? "home-daily-hero" : `home-desktop-${slot}`}
      style={styles[slot]}
      onLayout={(event) => setLocalOffset(event.nativeEvent.layout.y)}
    >
      <HomeDesktopGridOffsetContext value={contentOffset}>
        {children}
      </HomeDesktopGridOffsetContext>
    </View>
  );
}

/** Converts local target layout into a vertical offset within scroll content. */
export function HomeDesktopGridOffsetTarget({
  children,
  onOffset,
}: OffsetTargetProps) {
  const parentOffset = useContext(HomeDesktopGridOffsetContext);
  const [localOffset, setLocalOffset] = useState<number | null>(null);

  useEffect(() => {
    if (parentOffset !== null && localOffset !== null) {
      onOffset(parentOffset + localOffset);
    }
  }, [localOffset, onOffset, parentOffset]);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => setLocalOffset(event.nativeEvent.layout.y),
    [],
  );

  return children(onLayout);
}

const styles = StyleSheet.create((theme) => ({
  root: {
    gap: theme.spacing.stackLg,
  },
  hero: {
    minWidth: 0,
  },
  djs: {
    minWidth: 0,
  },
  shelves: {
    gap: theme.spacing.stackLg,
    minWidth: 0,
  },
  lower: {
    flexDirection: { xs: "column", xl: "row" },
    alignItems: "stretch",
    gap: theme.spacing.stackLg,
  },
  library: {
    flexBasis: { xs: "auto", xl: 0 },
    flexGrow: { xs: 0, xl: 3 },
    flexShrink: { xs: 0, xl: 1 },
    gap: theme.spacing.stackMd,
    minWidth: 0,
  },
  supporting: {
    flexBasis: { xs: "auto", xl: 0 },
    flexGrow: { xs: 0, xl: 2 },
    flexShrink: { xs: 0, xl: 1 },
    gap: theme.spacing.stackLg,
    minWidth: 0,
  },
}));
