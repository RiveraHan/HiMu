import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import type { JsonElement } from "test-renderer";
import {
  VibeDjsSkeleton,
  VibeInsightSkeleton,
} from "@/src/components/vibe/VibeCheckSkeletons";

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

describe("Vibe Check skeleton compositions", () => {
  it("matches the insight card, stat row, and genre-card geometry", async () => {
    const screen = await render(<VibeInsightSkeleton />);
    const tree = screen.toJSON();
    const skeletons = findSkeletons(tree);

    expect(skeletons).toHaveLength(12);
    expect(
      skeletons.some(
        ({ props }) => {
          const style = StyleSheet.flatten(props.style);
          return style.height === 150 && style.borderRadius === 12;
        },
      ),
    ).toBe(true);
    expectNoInteractions(tree);
    expect(
      skeletons.some(
        ({ props }) => {
          const style = StyleSheet.flatten(props.style);
          return style.height === 144 && style.borderRadius === 16;
        },
      ),
    ).toBe(true);
  });

  it("renders a section label and three complete Top DJ rows", async () => {
    const screen = await render(<VibeDjsSkeleton />);
    const tree = screen.toJSON();
    const skeletons = findSkeletons(tree);

    expect(skeletons).toHaveLength(16);
    expect(
      skeletons.filter(
        ({ props }) => StyleSheet.flatten(props.style).height === 48,
      ),
    ).toHaveLength(3);
    expectNoInteractions(tree);
  });
});
