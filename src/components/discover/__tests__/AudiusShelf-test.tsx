/* eslint-disable @typescript-eslint/no-require-imports */
import { render } from "@testing-library/react-native";
import { AudiusShelf } from "@/src/components/discover/AudiusShelf";

const mockUseAudiusTrending = jest.fn();

jest.mock("@/src/hooks/use-audius", () => ({
  useAudiusTrending: (...args: unknown[]) => mockUseAudiusTrending(...args),
}));

jest.mock("@/src/components", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    ContentShelf: (props: object) =>
      React.createElement(View, { ...props, testID: "content-shelf" }),
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
    const tracks = [{ id: "one" }, { id: "two" }, { id: "three" }];
    const onPlay = jest.fn();
    mockUseAudiusTrending.mockReturnValue({
      data: tracks,
      isPending: false,
      fetchStatus: "fetching",
    });

    const { getByTestId, queryByTestId } = await render(
      <AudiusShelf title="Trending" onPlay={onPlay} />,
    );

    const shelf = getByTestId("content-shelf");
    expect(shelf.props.title).toBe("Trending");
    expect(shelf.props.tracks).toBe(tracks);
    shelf.props.onPressTrack(tracks[1], 1);
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
    expect(screen.getByTestId("content-shelf").props.title).toBe("House");
  });
});
