import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { TrackCard } from "../TrackCard";
import { breakpoints } from "@/src/theme/breakpoints";

function resolveResponsive<T>(
  value: T | Partial<Record<keyof typeof breakpoints, T>> | undefined,
  width: number,
  fallback?: T,
) {
  if (value === null || typeof value !== "object") return value ?? fallback;
  const responsive = value as Partial<Record<keyof typeof breakpoints, T>>;
  return (Object.entries(breakpoints) as [keyof typeof breakpoints, number][])
    .filter(([, breakpoint]) => breakpoint <= width)
    .reduce<T | undefined>((resolved, [name]) => responsive[name] ?? resolved, fallback);
}

describe("TrackCard adaptive artwork geometry", () => {
  it.each([
    [390, "row", 64, 64, undefined],
    [1024, "column", "100%", "auto", 1],
    [1440, "column", "100%", "auto", 1],
  ] as const)(
    "resolves the real card and artwork at %ipx",
    async (width, direction, artworkWidth, artworkHeight, artworkRatio) => {
      const screen = await render(
        <TrackCard
          testID="adaptive-track"
          variant="adaptive"
          title="Signal Bloom"
          artist="DJ One"
          cover={null}
        />,
      );
      const card = screen.getByTestId("adaptive-track");
      const artwork = card.children[0];
      if (typeof artwork === "string") throw new Error("expected artwork host node");
      const cardStyle = StyleSheet.flatten(card.props.style);
      const artworkStyle = StyleSheet.flatten(artwork.props.style);

      expect(resolveResponsive(cardStyle.flexDirection, width, "column")).toBe(direction);
      expect(resolveResponsive(artworkStyle.width, width)).toBe(artworkWidth);
      expect(resolveResponsive(artworkStyle.height, width)).toBe(artworkHeight);
      expect(resolveResponsive(artworkStyle.aspectRatio, width)).toBe(artworkRatio);
    },
  );

  it.each([
    [1024, 888, 4, 210],
    [1440, 1232, 6, 192],
  ])(
    "resolves a %ipx viewport and %ipx usable canvas to %i square artwork cards",
    async (viewportWidth, usableWidth, columns, expectedSize) => {
      const screen = await render(
        <TrackCard
          testID="adaptive-track"
          variant="adaptive"
          title="Signal Bloom"
          artist="DJ One"
          cover={null}
        />,
      );
      const artwork = screen.getByTestId("adaptive-track").children[0];
      if (typeof artwork === "string") throw new Error("expected artwork host node");
      const artworkStyle = StyleSheet.flatten(artwork.props.style);
      const resolvedWidth = resolveResponsive(artworkStyle.width, viewportWidth);
      const resolvedRatio = resolveResponsive(artworkStyle.aspectRatio, viewportWidth);
      const resolvedCardWidth = (usableWidth - (columns - 1) * 16) / columns;

      expect(resolvedCardWidth).toBe(expectedSize);
      expect(resolvedWidth).toBe("100%");
      expect(resolvedRatio).toBe(1);
      expect({ width: resolvedCardWidth, height: resolvedCardWidth }).toEqual({
        width: expectedSize,
        height: expectedSize,
      });
    },
  );
});
