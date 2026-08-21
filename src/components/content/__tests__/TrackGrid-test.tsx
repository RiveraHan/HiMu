import { render } from "@testing-library/react-native";
import { Text, View } from "react-native";

import {
  TrackGrid,
  trackGridColumnLayout,
} from "@/src/components/content/TrackGrid";

const tracks = [
  { id: "first", title: "First" },
  { id: "second", title: "Second" },
  { id: "third", title: "Third" },
];

describe("TrackGrid", () => {
  it("defines the compact, medium, desktop, and wide column contract", () => {
    expect(trackGridColumnLayout).toEqual({
      xs: 1,
      lg: 2,
      xl: 4,
      wide: 6,
    });
  });

  it("keeps source order for visual and keyboard traversal", async () => {
    const screen = await render(
      <TrackGrid
        tracks={tracks}
        minCardWidth={180}
        renderTrack={(track, index) => (
          <View accessible accessibilityRole="button" accessibilityLabel={track.title}>
            <Text>{`${index + 1}. ${track.title}`}</Text>
          </View>
        )}
      />,
    );

    expect(screen.getAllByRole("button").map((node) => node.props.accessibilityLabel)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
    expect(screen.getAllByText(/^[1-3]\. /).map((node) => node.props.children)).toEqual([
      "1. First",
      "2. Second",
      "3. Third",
    ]);
  });

  it("does not shrink cards below the supplied square artwork width", async () => {
    const screen = await render(
      <TrackGrid
        tracks={tracks}
        minCardWidth={180}
        renderTrack={(track) => <View testID={`track-${track.id}`} />}
      />,
    );

    const items = tracks.map((track) => screen.getByTestId(`track-grid-item-${track.id}`));
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item).toHaveStyle({ minWidth: 180 });
      expect(item).not.toHaveStyle({ minHeight: 180 });
    }
  });
});
