import type { ReactNode } from "react";
import { View } from "react-native";

import { breakpoints } from "@/src/theme/breakpoints";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

type TrackWithId = { id: string };

type Props<T extends TrackWithId> = {
  tracks: readonly T[];
  minCardWidth: number;
  renderTrack: (track: T, index: number) => ReactNode;
};

export function resolveTrackGridColumns(width: number) {
  if (width >= breakpoints.xxl) return 6;
  if (width >= breakpoints.xl) return 4;
  if (width >= breakpoints.lg) return 2;
  return 1;
}

/** Shared by the rendered component and its breakpoint contract tests. */
export function createTrackGridItemStyle(minCardWidth: number) {
  return {
    flexGrow: 1,
    minWidth: minCardWidth,
    flexBasis: {
      xs: "100%",
      lg: "48%",
      xl: "23.5%",
      xxl: "15%",
    },
  } as const;
}

/**
 * A single flex tree that stays in source/keyboard order at every viewport.
 * Compact and medium columns are explicit; desktop lets the minimum card size
 * fill the available canvas (four cards at desktop, six on a wide canvas).
 */
export function TrackGrid<T extends TrackWithId>({
  tracks,
  minCardWidth,
  renderTrack,
}: Props<T>) {
  return (
    <View
      nativeID="himu-web-core-track-grid"
      style={styles.grid}
      testID="track-grid"
    >
      {tracks.map((track, index) => (
        <View
          key={track.id}
          testID={`track-grid-item-${track.id}`}
          style={styles.item(minCardWidth)}
        >
          {renderTrack(track, index)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.gutter,
    width: "100%",
  },
  item: createTrackGridItemStyle,
}));
