import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { JsonElement } from "test-renderer";
import { breakpoints } from "@/src/theme/breakpoints";
import {
  ProfileDjsSkeleton,
  ProfileIdentitySkeleton,
  ProfileStatsSkeleton,
} from "@/src/components/profile/ProfileSkeletons";

function findSkeletons(tree: JsonElement | null): JsonElement[] {
  if (!tree) return [];
  const children = (tree.children ?? []).filter(
    (child): child is JsonElement => typeof child !== "string",
  );
  return [
    ...(tree.props.accessibilityElementsHidden ? [tree] : []),
    ...children.flatMap(findSkeletons),
  ];
}

function findAllNodes(tree: JsonElement | null): JsonElement[] {
  if (!tree) return [];
  const children = tree.children.filter(
    (child): child is JsonElement => typeof child !== "string",
  );
  return [tree, ...children.flatMap(findAllNodes)];
}

function expectNoInteractions(tree: JsonElement | null) {
  expect(
    findAllNodes(tree).filter(
      ({ props }) =>
        typeof props.onPress === "function" ||
        ["button", "link", "menuitem"].includes(props.accessibilityRole),
    ),
  ).toHaveLength(0);
}

function resolveBreakpointStyle<T>(
  values: Partial<Record<keyof typeof breakpoints, T>> | T | undefined,
  width: number,
  fallback: T,
): T {
  if (values == null || typeof values !== "object") return values ?? fallback;

  const responsiveValues = values as Partial<Record<keyof typeof breakpoints, T>>;
  return (Object.entries(breakpoints) as [keyof typeof breakpoints, number][])
    .filter(([, minimumWidth]) => width >= minimumWidth)
    .reduce<T>((resolved, [breakpoint]) => responsiveValues[breakpoint] ?? resolved, fallback);
}

describe("Profile skeleton compositions", () => {
  it("matches the avatar and identity text geometry", async () => {
    const screen = await render(<ProfileIdentitySkeleton />);
    const tree = screen.toJSON();
    const skeletons = findSkeletons(tree);

    expect(skeletons).toHaveLength(3);
    expect(StyleSheet.flatten(skeletons[0].props.style)).toMatchObject({
      width: 128,
      height: 128,
      borderRadius: 9999,
    });
    expect(StyleSheet.flatten(screen.getByTestId("profile-identity-skeleton").props.style))
      .toEqual(expect.objectContaining({ flexDirection: { xs: "column", xl: "row" } }));
    expect(StyleSheet.flatten(screen.getByTestId("profile-identity-skeleton-text").props.style))
      .toEqual(expect.objectContaining({ alignItems: { xs: "center", xl: "flex-start" } }));
    expectNoInteractions(tree);
  });

  it("matches three stat cards and the listening identity card", async () => {
    const screen = await render(<ProfileStatsSkeleton />);
    const tree = screen.toJSON();
    const skeletons = findSkeletons(tree);

    expect(skeletons).toHaveLength(10);
    expect(
      skeletons.some(
        ({ props }) => {
          const style = StyleSheet.flatten(props.style);
          return style.height === 140 && style.borderRadius === 16;
        },
      ),
    ).toBe(true);
    expect(StyleSheet.flatten(screen.getByTestId("profile-stats-skeleton").props.style))
      .toEqual(expect.objectContaining({ flexDirection: { xs: "column", xl: "row" } }));
    expectNoInteractions(tree);
  });

  it("keeps exactly two compact DJ placeholders while retaining desktop extras in one tree", async () => {
    const screen = await render(<ProfileDjsSkeleton />);
    const tree = screen.toJSON();
    const skeletons = findSkeletons(tree);

    expect(skeletons).toHaveLength(13);
    expect(
      skeletons.filter(
        ({ props }) => StyleSheet.flatten(props.style).height === 64,
      ),
    ).toHaveLength(4);
    expect(StyleSheet.flatten(screen.getByTestId("profile-djs-skeleton-grid").props.style))
      .toEqual(expect.objectContaining({ flexWrap: "wrap" }));
    expect(StyleSheet.flatten(screen.getByTestId("profile-djs-skeleton-card-0").props.style))
      .toEqual(expect.objectContaining({ flexBasis: { xs: "45%", xl: "31.5%", xxl: "23.5%" } }));
    expect(StyleSheet.flatten(screen.getByTestId("profile-djs-skeleton-card-2").props.style))
      .toEqual(expect.objectContaining({ display: { xs: "none", xl: "flex" } }));
    expectNoInteractions(tree);
  });

  it("resolves rendered placeholders to 2, 3, 4, and 2 visible cards at target widths", async () => {
    const screen = await render(<ProfileDjsSkeleton />);
    const cards = [0, 1, 2, 3].map((index) => StyleSheet.flatten(
      screen.getByTestId(`profile-djs-skeleton-card-${index}`).props.style,
    ));
    const visibleCardCount = (width: number) => cards.filter(
      (style) => resolveBreakpointStyle(style.display, width, "flex") !== "none",
    ).length;
    const cardWidth = (width: number) => resolveBreakpointStyle(
      cards[0].flexBasis,
      width,
      "100%",
    );

    expect(visibleCardCount(390)).toBe(2);
    expect(cardWidth(390)).toBe("45%");
    expect(visibleCardCount(1280)).toBe(3);
    expect(cardWidth(1280)).toBe("31.5%");
    expect(visibleCardCount(1920)).toBe(4);
    expect(cardWidth(1920)).toBe("23.5%");
    // 1280px at 200% has a 640px effective CSS viewport.
    expect(visibleCardCount(640)).toBe(2);
    expect(cardWidth(640)).toBe("45%");
  });
});
