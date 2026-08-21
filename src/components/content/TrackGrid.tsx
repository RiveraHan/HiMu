import type { ReactNode } from "react";
import { View } from "react-native";

import { StyleSheet } from "@/src/theme/react-native-unistyles";

type TrackWithId = { id: string };

type Props<T extends TrackWithId> = {
  tracks: readonly T[];
  minCardWidth: number;
  renderTrack: (track: T, index: number) => ReactNode;
};

/**
 * The first three values map directly to the app's shared CSS breakpoints.
 * At wide desktop canvases, the desktop min card width naturally resolves to
 * six columns without changing the rendered tree or source order.
 */
export const trackGridColumnLayout = {
  xs: 1,
  lg: 2,
  xl: 4,
  wide: 6,
} as const;

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
    <View style={styles.grid} testID="track-grid">
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
  item: (minCardWidth: number) => ({
    flexGrow: 1,
    minWidth: minCardWidth,
    flexBasis: {
      xs: "100%",
      lg: "48%",
      xl: minCardWidth,
    },
  }),
}));
