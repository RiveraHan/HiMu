import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Platform, StyleSheet as RNStyleSheet } from "react-native";

import i18n from "@/src/i18n";
import { HiMuMomentCard } from "../HiMuMomentCard";

const mockConfirm = jest.fn();
const mockToast = { info: jest.fn(), warning: jest.fn(), error: jest.fn() };
const mockAnalytics = jest.fn();
const mockShareTrackMoment = jest.fn(async (_content: unknown, _dependencies: unknown) => ({ outcome: "cancelled" as const }));

jest.mock("@/src/hooks/use-confirm", () => ({ useConfirm: () => mockConfirm }));
jest.mock("@/src/hooks/use-toast", () => ({ useToast: () => mockToast }));
jest.mock("@/src/experience/product-analytics", () => ({ trackProductEvent: (...args: unknown[]) => mockAnalytics(...args) }));
jest.mock("@/src/moment/share-track", () => ({
  shareTrackMoment: (content: unknown, dependencies: unknown) => mockShareTrackMoment(content, dependencies),
}));

const VALID_SHARE_ORIGIN = "https://himu.test";

const track = {
  id: "00000000-0000-4000-8000-000000000021",
  title: "Signal Bloom",
  artist: "DJ One",
  album_art_url: "https://media.himu.test/cover.jpg",
};
const privateMoment = {
  trackId: track.id,
  visibility: "private" as const,
  audioUrl: "r2-private://tracks/generated/one.mp3",
  albumArtUrl: track.album_art_url,
};

function mutation<T>(value: T) {
  return { isPending: false, isError: false, mutateAsync: jest.fn(async () => value) };
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  mockConfirm.mockReset().mockResolvedValue(false);
  mockToast.info.mockReset();
  mockToast.warning.mockReset();
  mockToast.error.mockReset();
  mockAnalytics.mockReset();
  mockShareTrackMoment.mockClear();
  delete process.env.EXPO_PUBLIC_SHARE_ORIGIN;
});

test.each([
  ["missing", undefined],
  ["malformed", "not a URL"],
  ["non-root", "https://himu.test/beta"],
])("keeps publication unavailable when the %s share origin cannot produce a canonical link", async (_label, origin) => {
  if (origin) process.env.EXPO_PUBLIC_SHARE_ORIGIN = origin;
  mockConfirm.mockResolvedValue(true);
  const setVisibility = mutation({ ...privateMoment, visibility: "public" as const, audioUrl: "https://media.himu.test/generated.mp3" });
  const screen = await render(
    <HiMuMomentCard
      track={track}
      moment={privateMoment}
      feedback={{ surprised: null, wouldShare: null }}
      setVisibility={setVisibility}
      setFeedback={mutation({ surprised: null, wouldShare: null })}
    />,
  );

  expect(screen.getByText("Sharing is unavailable until a secure public link is configured.")).toBeTruthy();
  const publish = screen.getByTestId("moment-publish");
  expect(publish).toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  await act(async () => { fireEvent.press(publish); });
  expect(mockConfirm).not.toHaveBeenCalled();
  expect(setVisibility.mutateAsync).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Did this result surprise you?")).toBeTruthy();
});

test("disables sharing for an already-public track when the canonical origin is unavailable", async () => {
  const screen = await render(
    <HiMuMomentCard
      track={track}
      moment={{ ...privateMoment, visibility: "public", audioUrl: "https://media.himu.test/generated.mp3" }}
      feedback={{ surprised: null, wouldShare: null }}
      setVisibility={mutation(privateMoment)}
      setFeedback={mutation({ surprised: null, wouldShare: null })}
    />,
  );

  const share = screen.getByTestId("moment-share");
  expect(share).toHaveProp("accessibilityState", expect.objectContaining({ disabled: true }));
  expect(screen.getByTestId("moment-make-private")).toHaveProp(
    "accessibilityState",
    expect.objectContaining({ disabled: false }),
  );
  await act(async () => { fireEvent.press(share); });
  expect(mockShareTrackMoment).not.toHaveBeenCalled();
  expect(mockAnalytics).not.toHaveBeenCalledWith("moment_share_selected", expect.anything());
});

test("keeps a private ready track private until the user confirms publication", async () => {
  process.env.EXPO_PUBLIC_SHARE_ORIGIN = VALID_SHARE_ORIGIN;
  const setVisibility = mutation({ ...privateMoment, visibility: "public" as const, audioUrl: "https://media.himu.test/generated.mp3" });
  const screen = await render(
    <HiMuMomentCard
      track={track}
      moment={privateMoment}
      feedback={{ surprised: null, wouldShare: null }}
      setVisibility={setVisibility}
      setFeedback={mutation({ surprised: true, wouldShare: null })}
    />,
  );

  await act(async () => { fireEvent.press(screen.getByTestId("moment-publish")); });
  await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
  expect(setVisibility.mutateAsync).not.toHaveBeenCalled();
});

test("publishes only after confirmation and offers independent private answers", async () => {
  process.env.EXPO_PUBLIC_SHARE_ORIGIN = VALID_SHARE_ORIGIN;
  mockConfirm.mockResolvedValue(true);
  const setVisibility = mutation({ ...privateMoment, visibility: "public" as const, audioUrl: "https://media.himu.test/generated.mp3" });
  const setFeedback = mutation({ surprised: true, wouldShare: null });
  const screen = await render(
    <HiMuMomentCard
      track={track}
      moment={privateMoment}
      feedback={{ surprised: null, wouldShare: null }}
      setVisibility={setVisibility}
      setFeedback={setFeedback}
    />,
  );

  await act(async () => { fireEvent.press(screen.getByTestId("moment-publish")); });
  await waitFor(() => expect(setVisibility.mutateAsync).toHaveBeenCalledWith({ trackId: track.id, visibility: "public" }));
  expect(screen.getByLabelText("Did this result surprise you?")).toBeTruthy();
  expect(screen.getByLabelText("Would you share it?")).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getAllByLabelText("Yes")[0]!); });
  await waitFor(() => expect(setFeedback.mutateAsync).toHaveBeenCalledWith({ trackId: track.id, surprised: true }));
});

test("localizes feedback choices and exposes checked radio state with 44px targets", async () => {
  await i18n.changeLanguage("es");
  const screen = await render(
    <HiMuMomentCard
      track={track}
      moment={privateMoment}
      feedback={{ surprised: true, wouldShare: false }}
      setVisibility={mutation(privateMoment)}
      setFeedback={mutation({ surprised: true, wouldShare: false })}
    />,
  );

  const yes = screen.getAllByRole("radio", { name: "Sí" });
  const no = screen.getAllByRole("radio", { name: "No" });
  expect(yes).toHaveLength(2);
  expect(no).toHaveLength(2);
  expect(yes[0]).toHaveProp("accessibilityState", expect.objectContaining({ checked: true, disabled: false }));
  expect(no[1]).toHaveProp("accessibilityState", expect.objectContaining({ checked: true, disabled: false }));
  expect(RNStyleSheet.flatten(yes[0]!.props.style)).toEqual(expect.objectContaining({ minHeight: 44 }));
});

test("uses roving arrow navigation for each feedback radiogroup on web", async () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(Platform, "OS");
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  try {
    const setFeedback = mutation({ surprised: false, wouldShare: null });
    const screen = await render(
      <HiMuMomentCard
        track={track}
        moment={privateMoment}
        feedback={{ surprised: null, wouldShare: null }}
        setVisibility={mutation(privateMoment)}
        setFeedback={setFeedback}
      />,
    );

    const firstYes = screen.getAllByRole("radio", { name: "Yes" })[0]!;
    const firstNo = screen.getAllByRole("radio", { name: "No" })[0]!;
    expect([firstYes.props.tabIndex, firstNo.props.tabIndex]).toEqual([0, -1]);
    await fireEvent(firstYes, "keyDown", { key: "ArrowRight", preventDefault: jest.fn() });
    expect(screen.getAllByRole("radio", { name: "No" })[0]).toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));
    expect(screen.getAllByRole("radio", { name: "No" })[0]!.props.tabIndex).toBe(0);
  } finally {
    if (originalPlatform) Object.defineProperty(Platform, "OS", originalPlatform);
  }
});

test("keeps a failed feedback choice selected and announces retry success", async () => {
  const mutateAsync = jest.fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ surprised: true, wouldShare: null });
  const setFeedback = { isPending: false, isError: false, mutateAsync };
  const screen = await render(
    <HiMuMomentCard
      track={track}
      moment={privateMoment}
      feedback={{ surprised: null, wouldShare: null }}
      setVisibility={mutation(privateMoment)}
      setFeedback={setFeedback}
    />,
  );

  const yes = screen.getAllByRole("radio", { name: "Yes" })[0]!;
  await act(async () => { fireEvent.press(yes); });
  await waitFor(() => expect(screen.getByText("We couldn't save that answer. Try again.")).toBeTruthy());
  expect(screen.getAllByRole("radio", { name: "Yes" })[0]).toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));

  await act(async () => { fireEvent.press(screen.getAllByRole("radio", { name: "Yes" })[0]!); });
  await waitFor(() => expect(screen.getByText("Answer saved.")).toBeTruthy());
  expect(screen.getAllByRole("radio", { name: "Yes" })[0]).toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));
  expect(mutateAsync).toHaveBeenCalledTimes(2);
});

test("emits only bounded visibility-opened and share-selected analytics at user actions", async () => {
  process.env.EXPO_PUBLIC_SHARE_ORIGIN = VALID_SHARE_ORIGIN;
  mockConfirm.mockResolvedValue(false);
  const screen = await render(
    <HiMuMomentCard
      track={track}
      moment={privateMoment}
      feedback={{ surprised: null, wouldShare: null }}
      setVisibility={mutation(privateMoment)}
      setFeedback={mutation({ surprised: null, wouldShare: null })}
    />,
  );

  await act(async () => { fireEvent.press(screen.getByTestId("moment-publish")); });
  expect(mockAnalytics).toHaveBeenCalledWith("moment_visibility_opened", {
    trackId: track.id,
    visibility: "public",
  });

  await screen.rerender(
    <HiMuMomentCard
      track={track}
      moment={{ ...privateMoment, visibility: "public", audioUrl: "https://media.himu.test/generated.mp3" }}
      feedback={{ surprised: null, wouldShare: null }}
      setVisibility={mutation(privateMoment)}
      setFeedback={mutation({ surprised: null, wouldShare: null })}
    />,
  );
  await act(async () => { fireEvent.press(screen.getByTestId("moment-share")); });
  expect(mockAnalytics).toHaveBeenCalledWith("moment_share_selected", {
    trackId: track.id,
    shareMethod: expect.stringMatching(/^(native_share|web_share|clipboard|selectable_url)$/),
  });
  expect(JSON.stringify(mockAnalytics.mock.calls)).not.toMatch(/Signal Bloom|DJ One|himu\.test\/track|clipboardContents|recipient/);
});

test("collapses locally without removing feedback controls from the player", async () => {
  const screen = await render(
    <HiMuMomentCard
      track={track}
      moment={privateMoment}
      feedback={{ surprised: false, wouldShare: true }}
      setVisibility={mutation(privateMoment)}
      setFeedback={mutation({ surprised: false, wouldShare: true })}
    />,
  );
  expect(screen.getByText("Did this result surprise you?")).toBeTruthy();
  await fireEvent.press(screen.getByTestId("moment-collapse"));
  await waitFor(() => expect(screen.queryByText("Did this result surprise you?")).toBeNull());
  await fireEvent.press(screen.getByTestId("moment-collapse"));
  expect(screen.getByText("Did this result surprise you?")).toBeTruthy();
});
