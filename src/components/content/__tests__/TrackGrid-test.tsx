import { render } from "@testing-library/react-native";
import { Text, View } from "react-native";

import {
  createTrackGridItemStyle,
  resolveTrackGridColumns,
  TrackGrid,
} from "@/src/components/content/TrackGrid";

const tracks = [
  { id: "first", title: "First" },
  { id: "second", title: "Second" },
  { id: "third", title: "Third" },
];

describe("TrackGrid", () => {
  it.each([
    [390, 1],
    [768, 2],
    [1024, 4],
    [1440, 6],
  ])("resolves %i px to exactly %i columns", (width, columns) => {
    expect(resolveTrackGridColumns(width)).toBe(columns);
  });

  it("uses the same responsive item style map for the rendered grid", () => {
    expect(createTrackGridItemStyle(185)).toEqual({
      flexGrow: 1,
      minWidth: 185,
      flexBasis: {
        xs: "100%",
        lg: "48%",
        xl: "23.5%",
        xxl: "15%",
      },
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
      expect(item.props.style).toEqual(createTrackGridItemStyle(180));
      expect(item).toHaveStyle({ minWidth: 180 });
      expect(item).not.toHaveStyle({ minHeight: 180 });
    }
  });

  it("keeps four desktop or six wide cards within their usable canvas", () => {
    const gutter = 16;
    const minCardWidth = 185;
    const desktopCanvas = 1024 - 48;
    const wideCanvas = 1280 - 48;

    expect(4 * (desktopCanvas * 0.235) + 3 * gutter).toBeLessThanOrEqual(desktopCanvas);
    expect(5 * (desktopCanvas * 0.235) + 4 * gutter).toBeGreaterThan(desktopCanvas);
    expect(6 * minCardWidth + 5 * gutter).toBeLessThanOrEqual(wideCanvas);
    expect(7 * (wideCanvas * 0.15) + 6 * gutter).toBeGreaterThan(wideCanvas);
  });
});
