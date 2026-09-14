/** @jest-environment node */

import { View } from "react-native";
// Expo ships react-dom at runtime; the optional type package is not installed.
// @ts-expect-error react-dom's optional type package is not installed in this workspace
import { renderToStaticMarkup } from "react-dom/server";

import { PublicTrackAudio } from "../PublicTrackAudio";
import { PlayerProvider } from "../player-provider";

const mockUseAudioPlayer = jest.fn(() => {
  throw new Error("Audio is not defined");
});

jest.mock("react-native", () => jest.requireActual("react-native-web"));
jest.mock("@/src/components/Button", () => ({ Button: () => null }));
jest.mock("@/src/components/Text", () => ({ Text: () => null }));
jest.mock("@/src/theme/react-native-unistyles", () => ({
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock("@/src/api/supabase", () => ({ supabase: {} }));
jest.mock("@/src/api/auth-scope", () => ({
  assertCurrentMutationUser: jest.fn(),
  captureAuthScope: jest.fn(),
  setAuthScopeHeader: jest.fn(),
}));
jest.mock("@/src/stores/auth-store", () => ({
  useAuthStore: Object.assign(
    (selector: (state: { session: null }) => unknown) => selector({ session: null }),
    { getState: () => ({ session: null }) },
  ),
}));
jest.mock("@/src/stores/player-store", () => ({
  usePlayerStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}));
jest.mock("@/src/stores/toast-store", () => ({ useToastStore: { getState: jest.fn() } }));
jest.mock("@/src/stores/confirm-store", () => ({ useConfirmStore: { getState: jest.fn() } }));
jest.mock("expo-audio", () => ({
  setAudioModeAsync: jest.fn(),
  useAudioPlayer: () => mockUseAudioPlayer(),
  useAudioPlayerStatus: jest.fn(),
}));

const track = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Public track",
  artist: "HiMu",
  albumArtUrl: null,
  audioUrl: "https://media.example/public-track.mp3",
  duration: 180,
  genre: null,
  moods: [],
} as const;

describe("web audio server-render boundary", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not construct the authenticated player while rendering on the server", () => {
    expect(() => {
      renderToStaticMarkup(
        <PlayerProvider>
          <View testID="server-child" />
        </PlayerProvider>,
      );
    }).not.toThrow();

    expect(mockUseAudioPlayer).not.toHaveBeenCalled();
  });

  it("does not construct a public player while rendering on the server", () => {
    expect(() => {
      renderToStaticMarkup(<PublicTrackAudio track={track} />);
    }).not.toThrow();

    expect(mockUseAudioPlayer).not.toHaveBeenCalled();
  });
});
