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

  it("matches the heading and responsive DJ grid geometry", async () => {
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
    expectNoInteractions(tree);
  });
});
