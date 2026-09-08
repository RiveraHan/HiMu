import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import i18n from "@/src/i18n";
import { HiMuMomentCard } from "../HiMuMomentCard";

const mockConfirm = jest.fn();
const mockToast = { info: jest.fn(), warning: jest.fn(), error: jest.fn() };
const mockAnalytics = jest.fn();

jest.mock("@/src/hooks/use-confirm", () => ({ useConfirm: () => mockConfirm }));
jest.mock("@/src/hooks/use-toast", () => ({ useToast: () => mockToast }));
jest.mock("@/src/experience/product-analytics", () => ({ trackProductEvent: (...args: unknown[]) => mockAnalytics(...args) }));

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
  delete process.env.EXPO_PUBLIC_SHARE_ORIGIN;
});

test("keeps a private ready track private until the user confirms publication", async () => {
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
