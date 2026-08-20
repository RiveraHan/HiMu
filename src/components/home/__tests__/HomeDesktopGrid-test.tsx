import { render } from "@testing-library/react-native";
import { StyleSheet, View } from "react-native";
import { ContentShelf } from "@/src/components/home/ContentShelf";
import { HomeDesktopGrid, HomeDesktopGridSlot } from "@/src/components/home/HomeDesktopGrid";
import { shelfLayoutBreakpoints } from "@/src/components/home/shelf-layout";

jest.mock("@/src/hooks/use-auth", () => ({ useCurrentUser: () => ({ id: "listener" }) }));
jest.mock("@/src/stores/player-store", () => ({
  usePlayerStore: (selector: (state: object) => unknown) => selector({ currentTrack: null }),
}));
const tracks = ["one", "two", "three", "four"].map((id) => ({
  id,
  title: id,
  artist: "Artist",
  album_art_url: null,
  audio_url: `${id}.mp3`,
  duration: 180,
  owner_id: "listener",
  is_public: false,
}));

describe("HomeDesktopGrid", () => {
  it("keeps one DOM reading order while CSS creates the desktop lower two-column composition", async () => {
    const screen = await render(
      <HomeDesktopGrid>
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

  it("maps the real shelf to shared breakpoint tokens while preserving privacy markers", async () => {
    const screen = await render(
      <ContentShelf
        title="Fresh"
        presentation="grid"
        tracks={tracks}
        onPressTrack={jest.fn()}
      />,
    );

    const shelf = screen.getByTestId("content-shelf-scroll");
    expect(shelf).toBeTruthy();
    expect(StyleSheet.flatten(shelf.props.contentContainerStyle)).toEqual(
      expect.objectContaining({
        flexWrap: shelfLayoutBreakpoints.flexWrap,
        width: shelfLayoutBreakpoints.contentWidth,
      }),
    );
    expect(StyleSheet.flatten(screen.getByTestId("content-shelf-item-one").props.style))
      .toEqual(expect.objectContaining({ minWidth: shelfLayoutBreakpoints.tileMinWidth }));
    expect(screen.getAllByText("Private")).toHaveLength(4);
  });
});
