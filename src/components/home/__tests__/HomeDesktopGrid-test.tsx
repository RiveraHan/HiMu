/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import { StyleSheet, View } from "react-native";
import { ContentShelf } from "@/src/components/home/ContentShelf";
import { HomeDesktopGrid, HomeDesktopGridSlot } from "@/src/components/home/HomeDesktopGrid";

jest.mock("@/src/hooks/use-auth", () => ({ useCurrentUser: () => ({ id: "listener" }) }));
jest.mock("@/src/stores/player-store", () => ({
  usePlayerStore: (selector: (state: object) => unknown) => selector({ currentTrack: null }),
}));
jest.mock("@/src/components/TrackCard", () => ({
  TrackCard: ({ title }: { title: string }) => {
    const React = require("react");
    const { View: NativeView } = require("react-native");
    return React.createElement(NativeView, { testID: `track-${title}` });
  },
}));

const tracks = ["one", "two", "three", "four"].map((id) => ({
  id,
  title: id,
  artist: "Artist",
  album_art_url: null,
  audio_url: `${id}.mp3`,
  duration: 180,
}));

describe("HomeDesktopGrid", () => {
  it("keeps one DOM reading order while CSS creates the desktop lower two-column composition", async () => {
    const screen = await render(
      <HomeDesktopGrid layoutMode="desktop">
        <HomeDesktopGridSlot slot="hero"><View testID="hero" /></HomeDesktopGridSlot>
        <HomeDesktopGridSlot slot="djs"><View testID="djs" /></HomeDesktopGridSlot>
        <HomeDesktopGridSlot slot="shelves"><View testID="shelves" /></HomeDesktopGridSlot>
        <HomeDesktopGridSlot slot="lower">
          <HomeDesktopGridSlot slot="library"><View testID="library" /></HomeDesktopGridSlot>
          <HomeDesktopGridSlot slot="supporting"><View testID="supporting" /></HomeDesktopGridSlot>
        </HomeDesktopGridSlot>
      </HomeDesktopGrid>,
    );

    expect(screen.getByTestId("home-desktop-grid")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId("library").parent?.parent?.props.style))
      .toEqual(expect.objectContaining({ flexDirection: { xs: "column", xl: "row" } }));
    expect(screen.getByTestId("hero")).toBeTruthy();
    expect(screen.getByTestId("supporting")).toBeTruthy();
  });

  it("uses complete 180px-minimum cards for a desktop grid shelf", async () => {
    const screen = await render(
      <ContentShelf
        title="Fresh"
        presentation="grid"
        tracks={tracks}
        onPressTrack={jest.fn()}
      />,
    );

    expect(screen.getByTestId("content-shelf-grid")).toBeTruthy();
    expect(screen.queryByTestId("content-shelf-scroll")).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId("content-shelf-grid-item-one").props.style))
      .toEqual(expect.objectContaining({ minWidth: 180 }));
    expect(screen.getAllByTestId(/^track-/)).toHaveLength(4);
  });
});
