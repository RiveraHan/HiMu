/* eslint-disable @typescript-eslint/no-require-imports */
import { act, render } from "@testing-library/react-native";

import WelcomeScreen from "@/app/welcome";
import {
  consumeIntroLoginPermit,
  observeIntroRouteTransition,
} from "@/src/experience/intro-login-permit";

type CapturedCallbacks = {
  onCreate(): void | Promise<void>;
  onExistingAccount(): void | Promise<void>;
};

const mockRouterReplace = jest.fn();
const mockIntroMarkSeen = jest.fn();
const mockWriteFirstTrack = jest.fn();
const mockTrackProductEvent = jest.fn().mockResolvedValue(undefined);
let mockAuthState = { session: null as null | { user: { id: string } } };
let mockSearchParams: { step: string; mode?: string } = { step: "3" };
let mockCallbacks: CapturedCallbacks | null = null;

jest.mock("@/src/components/experience/PublicProductIntro", () => ({
  PublicProductIntro: ({ callbacks }: { callbacks: CapturedCallbacks }) => {
    const { View } = require("react-native");
    mockCallbacks = callbacks;
    return <View testID="captured-public-intro" />;
  },
}));

jest.mock("@/src/stores/auth-store", () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));

jest.mock("@/src/experience", () => ({
  PUBLIC_INTRO_VERSION: 2,
  introStateStore: {
    markSeen: (...args: unknown[]) => mockIntroMarkSeen(...args),
  },
  pendingIntentStore: {
    writeFirstTrack: (...args: unknown[]) => mockWriteFirstTrack(...args),
  },
  trackProductEvent: (...args: unknown[]) => mockTrackProductEvent(...args),
}));

jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return {
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
    router: {
      replace: (...args: unknown[]) => mockRouterReplace(...args),
      setParams: jest.fn(),
    },
    useLocalSearchParams: () => mockSearchParams,
  };
});

async function invoke(callback: () => void | Promise<void>) {
  await act(async () => {
    await callback();
  });
}

describe("welcome route authorization", () => {
  beforeEach(() => {
    observeIntroRouteTransition(["test-reset"]);
    consumeIntroLoginPermit();
    mockRouterReplace.mockReset();
    mockIntroMarkSeen.mockReset().mockResolvedValue(undefined);
    mockWriteFirstTrack.mockReset().mockResolvedValue(undefined);
    mockTrackProductEvent.mockClear();
    mockAuthState = { session: null };
    mockSearchParams = { step: "3" };
    mockCallbacks = null;
  });

  it("rejects captured signed-out callbacks before effects after auth becomes signed in", async () => {
    observeIntroRouteTransition(["welcome"]);
    const screen = await render(<WelcomeScreen />);
    const staleCallbacks = mockCallbacks!;

    mockAuthState = { session: { user: { id: "user-a" } } };
    await screen.rerender(<WelcomeScreen />);
    await invoke(staleCallbacks.onCreate);
    await invoke(staleCallbacks.onExistingAccount);

    expect(mockWriteFirstTrack).not.toHaveBeenCalled();
    expect(mockIntroMarkSeen).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(consumeIntroLoginPermit()).toBe(false);
  });

  it("rejects captured replay callbacks before navigation after the user changes", async () => {
    mockSearchParams = { step: "3", mode: "replay" };
    mockAuthState = { session: { user: { id: "user-a" } } };
    observeIntroRouteTransition(["welcome"]);
    const screen = await render(<WelcomeScreen />);
    const staleCallbacks = mockCallbacks!;

    mockAuthState = { session: { user: { id: "user-b" } } };
    await screen.rerender(<WelcomeScreen />);
    await invoke(staleCallbacks.onCreate);
    await invoke(staleCallbacks.onExistingAccount);

    expect(mockWriteFirstTrack).not.toHaveBeenCalled();
    expect(mockIntroMarkSeen).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(consumeIntroLoginPermit()).toBe(false);
  });
});
