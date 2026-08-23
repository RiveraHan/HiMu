import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";
import { useAuthStore } from "@/src/stores/auth-store";
import { CaptionVoiceButton } from "../CaptionVoiceButton";

const mockInvoke = jest.fn();
const mockVoice = {
  pause: jest.fn(),
  play: jest.fn(),
  replace: jest.fn(),
  seekTo: jest.fn(),
};

jest.mock("@/src/api/supabase", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
jest.mock("@/src/audio/use-player", () => ({
  usePlayer: () => ({ toggle: jest.fn() }),
}));
jest.mock("expo-audio", () => ({
  useAudioPlayer: () => mockVoice,
  useAudioPlayerStatus: () => ({ playing: false, isBuffering: false }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/src/theme/react-native-unistyles", () => ({
  StyleSheet: {
    hairlineWidth: 1,
    create: (factory: (theme: any) => unknown) => factory({
      borderRadius: { full: 999 },
      colors: {
        onSurface: "#fff",
        onSurfaceVariant: "#aaa",
        glassTintStrong: "#111",
        glassBorder: "#222",
      },
    }),
  },
  useUnistyles: () => ({
    theme: { colors: { onSurface: "#fff", onSurfaceVariant: "#aaa" } },
  }),
}));

function session(userId: string, token: string) {
  return {
    access_token: token,
    refresh_token: `refresh-${userId}`,
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
    },
  };
}

const props = {
  audioRef: "r2-private://captions/generated/job-1/attempt.mp3",
  jobId: "22222222-2222-4222-8222-222222222222",
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ session: session("user-a", "token-a") as never });
});

afterEach(() => cleanup());

test("resolves a private caption before isolated playback", async () => {
  mockInvoke.mockResolvedValue({
    data: { url: "https://signed.example/caption.mp3", expiresIn: 300 },
    error: null,
  });
  const screen = await render(<CaptionVoiceButton {...props} />);
  fireEvent.press(screen.getByLabelText("home.captionVoice.hear"));

  await waitFor(() => expect(mockVoice.replace).toHaveBeenCalledWith({
    uri: "https://signed.example/caption.mp3",
  }));
  expect(mockInvoke).toHaveBeenCalledWith("private-media-url", {
    body: { kind: "caption", jobId: props.jobId },
    headers: { Authorization: "Bearer token-a" },
  });
  expect(mockVoice.seekTo).toHaveBeenCalledWith(0);
  expect(mockVoice.play).toHaveBeenCalled();
});

test("discards a caption URL resolved after an auth switch", async () => {
  let resolve!: (value: unknown) => void;
  mockInvoke.mockReturnValue(new Promise((next) => { resolve = next; }));
  const screen = await render(<CaptionVoiceButton {...props} />);
  fireEvent.press(screen.getByLabelText("home.captionVoice.hear"));

  useAuthStore.setState({ session: session("user-b", "token-b") as never });
  await act(async () => {
    resolve({
      data: { url: "https://signed.example/caption.mp3", expiresIn: 300 },
      error: null,
    });
    await Promise.resolve();
  });

  expect(mockVoice.replace).not.toHaveBeenCalled();
  expect(mockVoice.play).not.toHaveBeenCalled();
});
