import { render } from "@testing-library/react-native";
import { StyleSheet, View } from "react-native";
import { DjHero } from "@/src/components/dj/DjHero";
import { DjProfileSkeleton } from "@/src/components/dj/DjProfileSkeleton";

describe("DjProfileSkeleton", () => {
  it("keeps the passed header in a full-width wrapper", async () => {
    const screen = await render(
      <DjProfileSkeleton
        header={<View testID="profile-header" />}
        paddingTop={24}
        paddingBottom={32}
      />,
    );

    expect(screen.getByTestId("profile-header").parent).toHaveStyle({
      alignSelf: "stretch",
    });
  });

  it("hides the vertical scroll indicator", async () => {
    const screen = await render(
      <DjProfileSkeleton
        header={<View testID="profile-header" />}
        paddingTop={24}
        paddingBottom={32}
      />,
    );

    const scrollView = screen.container.queryAll(
      (instance) => instance.type === "RCTScrollView",
    )[0];

    expect(scrollView.props.showsVerticalScrollIndicator).toBe(false);
  });

  it("binds the real loaded hero geometry and placement to the skeleton shell", async () => {
    const loaded = await render(
      <DjHero
        testID="loaded-dj-hero"
        name="Nova"
        tagline="YOUR DJ"
      />,
    );
    const loadedHero = loaded.getByTestId("loaded-dj-hero");

    expect(loadedHero).toHaveStyle({
      alignSelf: "stretch",
      height: 380,
      borderRadius: 16,
      justifyContent: "flex-end",
      overflow: "hidden",
    });

    const placeholder = await render(
      <DjProfileSkeleton
        header={<View testID="profile-header" />}
        paddingTop={24}
        paddingBottom={32}
      />,
    );
    const shell = placeholder.getByTestId("dj-profile-hero-shell");
    const background = placeholder.getByTestId("dj-profile-hero-background", {
      includeHiddenElements: true,
    });
    const overlay = placeholder.getByTestId("dj-profile-hero-overlay");

    expect(shell).toHaveStyle({
      alignSelf: "stretch",
      height: 380,
      justifyContent: "flex-end",
      overflow: "hidden",
    });
    expect(background).toHaveStyle({
      width: "100%",
      height: 380,
      borderRadius: 16,
      ...StyleSheet.absoluteFillObject,
    });
    expect(background.parent).toBe(shell);
    expect(overlay.parent).toBe(shell);
    expect(shell.children.at(-1)).toBe(overlay);
  });
});
