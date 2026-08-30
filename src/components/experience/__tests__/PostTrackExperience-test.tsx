/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";

import i18n from "@/src/i18n";
import { PostTrackExperience } from "../PostTrackExperience";

const mockClaim = jest.fn();
const mockDismiss = jest.fn();
const mockTrackProductEvent = jest.fn();
const mockRouterPush = jest.fn();
let mockState: Record<string, unknown>;

jest.mock("@/src/experience/experience-state", () => ({
  useExperienceState: () => mockState,
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

const loadingState = { data: null, isLoading: true, isError: false };
const eligibleState = {
  data: {
    introVersionSeen: 2,
    firstOwnedTrackId: "track-first",
    firstOwnedTrackReadyAt: "2026-08-25T12:00:00.000Z",
    preferenceNudgeStatus: "eligible" as const,
    preferenceNudgeTrackId: "track-first",
  },
  isLoading: false,
  isError: false,
};

function MatchingBoundaries({ includeA }: { includeA: boolean }) {
  return (
    <>
      {includeA ? <PostTrackExperience key="a" trackId="track-first" /> : null}
      <PostTrackExperience key="b" trackId="track-first" />
    </>
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mockState = loadingState;
  mockClaim.mockReset();
  mockDismiss.mockReset();
  mockTrackProductEvent.mockReset();
  mockRouterPush.mockReset();
});

test("claims a matching eligible track before the preference card appears", async () => {
  const screen = await render(<PostTrackExperience trackId="track-first" />);
  expect(screen.queryByText("Make the next track feel more like you")).toBeNull();

  mockState = eligibleState;
  await screen.rerender(<PostTrackExperience trackId="track-first" />);
  await waitFor(() => expect(mockClaim).toHaveBeenCalledWith("track-first", expect.any(Object)));
  expect(screen.queryByText("Make the next track feel more like you")).toBeNull();

  mockState = {
    ...eligibleState,
    data: { ...eligibleState.data, preferenceNudgeStatus: "shown" as const },
  };
  await screen.rerender(<PostTrackExperience trackId="track-first" />);
  expect(screen.getByText("Make the next track feel more like you")).toBeTruthy();
});

test("shares one claim and one shown card across matching mounted boundaries", async () => {
  mockState = eligibleState;
  const screen = await render(
    <>
      <PostTrackExperience trackId="track-first" />
      <PostTrackExperience trackId="track-first" />
    </>,
  );

  await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(1));
  mockState = {
    ...eligibleState,
    data: { ...eligibleState.data, preferenceNudgeStatus: "shown" as const },
  };
  await screen.rerender(
    <>
      <PostTrackExperience trackId="track-first" />
      <PostTrackExperience trackId="track-first" />
    </>,
  );

  await waitFor(() => expect(screen.getAllByText("Make the next track feel more like you")).toHaveLength(1));
});

test("retains an in-flight eligible claim when its owning boundary unmounts", async () => {
  mockState = eligibleState;
  const screen = await render(<MatchingBoundaries includeA />);

  await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(1));
  await screen.rerender(<MatchingBoundaries includeA={false} />);

  expect(mockClaim).toHaveBeenCalledTimes(1);
});

test("retries a shared claim after unavailable experience state recovers", async () => {
  mockState = eligibleState;
  const screen = await render(<PostTrackExperience trackId="track-first" />);

  await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(1));
  mockState = { ...eligibleState, isError: true };
  await screen.rerender(<PostTrackExperience trackId="track-first" />);
  mockState = eligibleState;
  await screen.rerender(<PostTrackExperience trackId="track-first" />);

  await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(2));
});

test("transfers shown-card ownership when the claiming boundary unmounts", async () => {
  mockState = eligibleState;
  const screen = await render(<MatchingBoundaries includeA />);

  await waitFor(() => expect(mockClaim).toHaveBeenCalledTimes(1));
  mockState = {
    ...eligibleState,
    data: { ...eligibleState.data, preferenceNudgeStatus: "shown" as const },
  };
  await screen.rerender(<MatchingBoundaries includeA />);
  await waitFor(() => expect(screen.getAllByText("Make the next track feel more like you")).toHaveLength(1));

  await screen.rerender(<MatchingBoundaries includeA={false} />);
  await waitFor(() => expect(screen.getAllByText("Make the next track feel more like you")).toHaveLength(1));
  expect(mockClaim).toHaveBeenCalledTimes(1);
});

test("emits the shown event once when ownership transfers after the card is shown", async () => {
  mockState = {
    ...eligibleState,
    data: { ...eligibleState.data, preferenceNudgeStatus: "shown" as const },
  };
  const screen = await render(<MatchingBoundaries includeA />);

  await waitFor(() => expect(mockTrackProductEvent).toHaveBeenCalledWith(
    "preference_nudge_shown",
    expect.any(Object),
  ));
  await screen.rerender(<MatchingBoundaries includeA={false} />);
  await waitFor(() => expect(screen.getAllByText("Make the next track feel more like you")).toHaveLength(1));

  expect(mockTrackProductEvent.mock.calls.filter(([name]) => name === "preference_nudge_shown")).toHaveLength(1);
});

test("never renders or claims a nudge for a different current track", async () => {
  mockState = eligibleState;
  const screen = await render(<PostTrackExperience trackId="track-other" />);

  expect(screen.queryByText("Make the next track feel more like you")).toBeNull();
  expect(mockClaim).not.toHaveBeenCalled();
});

test("does not block the player when the claim cannot become shown", async () => {
  mockState = { ...eligibleState, isError: true };
  const screen = await render(<PostTrackExperience trackId="track-first" />);

  expect(screen.queryByText("Make the next track feel more like you")).toBeNull();
  expect(mockClaim).not.toHaveBeenCalled();
});

test("emits a privacy-safe shown event only after the claim has succeeded", async () => {
  mockState = {
    ...eligibleState,
    data: { ...eligibleState.data, preferenceNudgeStatus: "shown" as const },
  };
  await render(<PostTrackExperience trackId="track-first" />);

  expect(mockTrackProductEvent).toHaveBeenCalledWith("preference_nudge_shown", {
    flowVersion: 1,
    locale: "en",
    platform: Platform.OS === "web" ? "web" : Platform.OS === "android" ? "android" : "ios",
  });
});

test("emits privacy-safe acceptance analytics and navigates without hiding the shown card", async () => {
  mockState = {
    ...eligibleState,
    data: { ...eligibleState.data, preferenceNudgeStatus: "shown" as const },
  };
  const screen = await render(<PostTrackExperience trackId="track-first" />);

  fireEvent.press(screen.getByRole("button", { name: "Choose my preferences" }));

  expect(mockTrackProductEvent).toHaveBeenCalledWith("preference_nudge_accepted", {
    flowVersion: 1,
    locale: "en",
    platform: Platform.OS === "web" ? "web" : Platform.OS === "android" ? "android" : "ios",
  });
  expect(mockRouterPush).toHaveBeenCalledWith("/preferences");
  expect(screen.getByText("Make the next track feel more like you")).toBeTruthy();
});

test("dismisses the shown card with privacy-safe analytics", async () => {
  mockState = {
    ...eligibleState,
    data: { ...eligibleState.data, preferenceNudgeStatus: "shown" as const },
  };
  const screen = await render(<PostTrackExperience trackId="track-first" />);

  fireEvent.press(screen.getByRole("button", { name: "Not now" }));

  expect(mockDismiss).toHaveBeenCalledWith("track-first");
  expect(mockTrackProductEvent).toHaveBeenCalledWith("preference_nudge_dismissed", {
    flowVersion: 1,
    locale: "en",
    platform: Platform.OS === "web" ? "web" : Platform.OS === "android" ? "android" : "ios",
  });
});

test.each(["dismissed", "completed"] as const)("does not render a terminal %s nudge", async (status) => {
  mockState = {
    ...eligibleState,
    data: { ...eligibleState.data, preferenceNudgeStatus: status },
  };
  const screen = await render(<PostTrackExperience trackId="track-first" />);

  expect(screen.queryByText("Make the next track feel more like you")).toBeNull();
  expect(mockClaim).not.toHaveBeenCalled();
});

test("provides Spanish copy and accessible actions", async () => {
  await i18n.changeLanguage("es");
  mockState = {
    ...eligibleState,
    data: { ...eligibleState.data, preferenceNudgeStatus: "shown" as const },
  };
  const screen = await render(<PostTrackExperience trackId="track-first" />);

  expect(screen.getByRole("header", { name: "Haz que la próxima pista se parezca más a ti" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Elegir mis preferencias" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Ahora no" })).toBeTruthy();
});
