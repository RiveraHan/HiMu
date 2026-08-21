import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { JsonElement } from "test-renderer";
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

  it("maps rendered profile placeholders for 390, 1280, 1920, and 200% reflow", async () => {
    const screen = await render(<ProfileDjsSkeleton />);
    const compactCard = StyleSheet.flatten(
      screen.getByTestId("profile-djs-skeleton-card-0").props.style,
    );
    const desktopExtra = StyleSheet.flatten(
      screen.getByTestId("profile-djs-skeleton-card-2").props.style,
    );

    // 390px and a 1280px viewport at 200% both resolve the compact map.
    expect(compactCard.flexBasis.xs).toBe("45%");
    expect(desktopExtra.display.xs).toBe("none");
    // 1280px resolves three cards; 1920px resolves four.
    expect(compactCard.flexBasis.xl).toBe("31.5%");
    expect(compactCard.flexBasis.xxl).toBe("23.5%");
    expect(desktopExtra.display.xl).toBe("flex");
  });
});
