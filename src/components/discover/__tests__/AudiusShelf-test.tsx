/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render } from "@testing-library/react-native";
import { AudiusShelf } from "@/src/components/discover/AudiusShelf";
import i18n from "@/src/i18n";

const mockUseAudiusTrending = jest.fn();

jest.mock("@/src/hooks/use-audius", () => ({
  useAudiusTrending: (...args: unknown[]) => mockUseAudiusTrending(...args),
}));

jest.mock("@/src/components", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    ContentShelf:
      jest.requireActual("@/src/components/home/ContentShelf").ContentShelf,
    ContentShelfSkeleton: () =>
      React.createElement(View, { testID: "content-shelf-skeleton" }),
  };
});

describe("AudiusShelf", () => {
  it("shows a shelf skeleton for an unresolved initial request", async () => {
    mockUseAudiusTrending.mockReturnValue({
      data: undefined,
      isPending: true,
      fetchStatus: "fetching",
    });

    const { getByTestId } = await render(
      <AudiusShelf title="Trending" onPlay={jest.fn()} />,
    );

    expect(getByTestId("content-shelf-skeleton")).toBeTruthy();
  });

  it("keeps cached shelf content visible during a refetch", async () => {
    const tracks = [
      { id: "one", title: "One", artist: "Artist One" },
      { id: "two", title: "Two", artist: "Artist Two" },
      { id: "three", title: "Three", artist: "Artist Three" },
    ];
    const onPlay = jest.fn();
    mockUseAudiusTrending.mockReturnValue({
      data: tracks,
      isPending: false,
      fetchStatus: "fetching",
    });

    const { getByLabelText, getByText, queryByTestId } = await render(
      <AudiusShelf title="Trending" onPlay={onPlay} />,
    );

    expect(getByText("Trending")).toBeTruthy();
    await fireEvent.press(getByLabelText("Play Two by Artist Two"));
    expect(onPlay).toHaveBeenCalledWith(tracks, tracks[1], 1);
    expect(queryByTestId("content-shelf-skeleton")).toBeNull();
  });

  it("lets distinct shelves resolve independently", async () => {
    const houseTracks = [
      { id: "house-one" },
      { id: "house-two" },
      { id: "house-three" },
    ];
    mockUseAudiusTrending.mockImplementation((genre?: string) =>
      genre === "House"
        ? { data: houseTracks, isPending: false, fetchStatus: "idle" }
        : { data: undefined, isPending: true, fetchStatus: "fetching" },
    );

    const screen = await render(
      <>
        <AudiusShelf title="Electronic" genre="Electronic" onPlay={jest.fn()} />
        <AudiusShelf title="House" genre="House" onPlay={jest.fn()} />
      </>,
    );

    expect(screen.getAllByTestId("content-shelf-skeleton")).toHaveLength(1);
    expect(screen.getByText("House")).toBeTruthy();
  });

  it("exposes Spanish play accessibility while preserving Audius content", async () => {
    await i18n.changeLanguage("es");
    const tracks = [
      { id: "one", title: "Bruma", artist: "Nombre Real" },
      { id: "two", title: "Dos", artist: "Artista Dos" },
      { id: "three", title: "Tres", artist: "Artista Tres" },
    ];
    mockUseAudiusTrending.mockReturnValue({
      data: tracks,
      isPending: false,
      fetchStatus: "idle",
    });

    const screen = await render(
      <AudiusShelf title="Ambiental" genre="Ambient" onPlay={jest.fn()} />,
    );

    expect(mockUseAudiusTrending).toHaveBeenCalledWith("Ambient");
    expect(screen.getByText("Ambiental")).toBeTruthy();
    expect(screen.getByText("Bruma")).toBeTruthy();
    expect(screen.getByText("Nombre Real")).toBeTruthy();
    expect(
      screen.getByLabelText("Reproducir Bruma de Nombre Real"),
    ).toBeTruthy();
  });
});
