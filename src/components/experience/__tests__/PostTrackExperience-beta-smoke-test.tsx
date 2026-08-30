/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render } from "@testing-library/react-native";

import { BETA_SMOKE_TRACK_ID } from "@/src/beta-smoke";
import { PostTrackExperience } from "../PostTrackExperience";

const mockClaim = jest.fn();
const mockDismiss = jest.fn();
const mockTrackProductEvent = jest.fn();
const mockRouterPush = jest.fn();

jest.mock("@/src/experience/experience-state", () => ({
  useExperienceState: () => ({
    data: {
      introVersionSeen: 1,
      firstOwnedTrackId: "beta-smoke-track-first",
      firstOwnedTrackReadyAt: "2026-08-29T00:00:00.000Z",
      preferenceNudgeStatus: "shown",
      preferenceNudgeTrackId: "beta-smoke-track-first",
    },
    isLoading: false,
    isError: false,
  }),
  useClaimPreferenceNudge: () => ({ mutate: mockClaim, isPending: false }),
  useDismissPreferenceNudge: () => ({ mutate: mockDismiss }),
}));
jest.mock("@/src/experience/product-analytics", () => ({
  trackProductEvent: (...args: unknown[]) => mockTrackProductEvent(...args),
}));
jest.mock("@/src/i18n/use-locale", () => ({
  useLocale: () => ({ resolvedLanguage: "en" }),
}));
jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));
jest.mock("@/src/components/GlassCard", () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => {
    const { View } = require("react-native");
    return <View>{children}</View>;
  },
}));
jest.mock("@/src/components/Text", () => {
  const { Text } = require("react-native");
  return { Text };
});

beforeEach(() => {
  process.env.EXPO_PUBLIC_BETA_SMOKE = "1";
  mockClaim.mockReset();
  mockDismiss.mockReset();
  mockTrackProductEvent.mockReset();
  mockRouterPush.mockReset();
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_BETA_SMOKE;
});

test("the exact local smoke nudge keeps experience local and never opens analytics transport", async () => {
  const screen = await render(
    <PostTrackExperience trackId={BETA_SMOKE_TRACK_ID} isBetaSmokeFixture />,
  );
  await act(async () => {});

  expect(screen.getByText("Make the next track feel more like you")).toBeTruthy();
  expect(mockClaim).not.toHaveBeenCalled();
  expect(mockTrackProductEvent).not.toHaveBeenCalled();

  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Choose my preferences" }));
  });
  await act(async () => {
    fireEvent.press(screen.getByRole("button", { name: "Not now" }));
  });

  expect(mockDismiss).toHaveBeenCalledWith(BETA_SMOKE_TRACK_ID);
  expect(mockRouterPush).toHaveBeenCalledWith("/preferences");
  expect(mockTrackProductEvent).not.toHaveBeenCalled();
  screen.unmount();
});
