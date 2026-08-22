/* eslint-disable @typescript-eslint/no-require-imports */
import { act, render } from "@testing-library/react-native";

import { ConnectedDesktopRail as WebConnectedDesktopRail } from "@/src/components/navigation/ConnectedDesktopRail.web";

const { ConnectedDesktopRail: NativeConnectedDesktopRail } = require("../ConnectedDesktopRail.tsx") as typeof import("../ConnectedDesktopRail");

let mockDjs: { id: string; owner_id: string | null }[] | undefined;

jest.mock("@/src/components/navigation/DesktopRail", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    DesktopRail: ({ ownedDjId }: { ownedDjId?: string | null }) => (
      <View testID="connected-desktop-rail" ownedDjId={ownedDjId} />
    ),
  };
});

jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => ({ id: "listener" }),
}));

jest.mock("@/src/hooks/use-home", () => ({
  useDJs: () => ({ data: mockDjs }),
}));

describe("ConnectedDesktopRail", () => {
  beforeEach(() => {
    mockDjs = undefined;
  });

  it("preserves an unknown ownership state while the web DJ query is unresolved", async () => {
    const screen = await render(<WebConnectedDesktopRail />);

    expect(screen.getByTestId("connected-desktop-rail").props.ownedDjId)
      .toBeUndefined();
  });

  it("distinguishes no owned DJ from a resolved owned DJ on web", async () => {
    mockDjs = [];
    const empty = await render(<WebConnectedDesktopRail />);
    expect(empty.getByTestId("connected-desktop-rail").props.ownedDjId).toBeNull();
    await act(async () => {
      empty.unmount();
    });

    mockDjs = [
      { id: "public-dj", owner_id: "someone-else" },
      { id: "owned-dj", owner_id: "listener" },
    ];
    const owned = await render(<WebConnectedDesktopRail />);
    expect(owned.getByTestId("connected-desktop-rail").props.ownedDjId)
      .toBe("owned-dj");
  });

  it("preserves the native rail's existing create-DJ fallback", async () => {
    const screen = await render(<NativeConnectedDesktopRail />);

    expect(screen.getByTestId("connected-desktop-rail").props.ownedDjId).toBeNull();
  });
});
