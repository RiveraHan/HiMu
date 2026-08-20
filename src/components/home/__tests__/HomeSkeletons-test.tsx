import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { LibraryCard } from "@/src/components/LibraryCard";
import { HomeHeroSkeleton, HomeLibraryRowSkeleton } from "@/src/components/home/HomeSkeletons";
import { ContentShelfSkeleton } from "@/src/components/skeleton/ContentSkeletons";

jest.mock("@/src/components", () => ({
  DjAvatarSkeleton:
    jest.requireActual("@/src/components/skeleton/ContentSkeletons")
      .DjAvatarSkeleton,
  GlassCard: jest.requireActual("@/src/components/GlassCard").GlassCard,
  Skeleton: jest.requireActual("@/src/components/skeleton/Skeleton").Skeleton,
}));

describe("Home skeleton geometry", () => {
  it("keeps the compact shelf placeholder horizontal", async () => {
    const placeholder = await render(<ContentShelfSkeleton />);

    expect(placeholder.getByTestId("content-shelf-skeleton-scroll")).toBeTruthy();
    expect(StyleSheet.flatten(placeholder.getByTestId("content-shelf-skeleton-scroll").props.contentContainerStyle))
      .toEqual(expect.objectContaining({
        flexWrap: "nowrap",
        width: undefined,
      }));
    expect(StyleSheet.flatten(placeholder.getByTestId("content-shelf-skeleton-tile-0").props.style))
      .toEqual(expect.objectContaining({
        minWidth: undefined,
      }));
    expect(StyleSheet.flatten(placeholder.getByTestId(
      "content-shelf-skeleton-tile-5",
      { includeHiddenElements: true },
    ).props.style))
      .toEqual(expect.objectContaining({
        display: "none",
      }));
  });

  it("reserves the desktop Daily Drop hero height before artwork loads", async () => {
    const placeholder = await render(<HomeHeroSkeleton />);
    const root = placeholder.toJSON();

    expect(StyleSheet.flatten(root?.props.style)).toEqual(expect.objectContaining({
      minHeight: { xs: undefined, xl: 220 },
    }));
  });

  it("keeps the Favorites placeholder at the loaded LibraryCard geometry", async () => {
    const loaded = await render(
      <LibraryCard testID="loaded-library-card" label="SAVED" title="Favorites" />,
    );
    expect(loaded.getByTestId("loaded-library-card")).toHaveStyle({
      height: 180,
      borderRadius: 24,
    });

    const placeholder = await render(<HomeLibraryRowSkeleton />);
    expect(
      placeholder.getByTestId("home-library-row-skeleton", {
        includeHiddenElements: true,
      }),
    ).toHaveStyle({ height: 180, borderRadius: 24 });
  });
});
