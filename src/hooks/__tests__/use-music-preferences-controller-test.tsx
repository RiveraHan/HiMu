import { act, renderHook, waitFor } from "@testing-library/react-native";

import { disposePreferenceCommitQueues } from "../preference-commit-queue";
import { useMusicPreferencesController } from "../use-music-preferences-controller";

const mockUpdate = jest.fn();
const mockCompleteNudge = jest.fn();
const mockTrackProductEvent = jest.fn();
let mockExperienceState: Record<string, unknown>;
const mockToastError = jest.fn();
const mockSetQueryData = jest.fn();
const mockCancelQueries = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockRefetch = jest.fn();
let mockOnline = true;
let mockUserId = "user-a";
let mockPreferencesQuery: Record<string, unknown>;
const mockQueryClient = {
  setQueryData: mockSetQueryData,
  cancelQueries: mockCancelQueries,
  invalidateQueries: mockInvalidateQueries,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mockQueryClient,
}));
jest.mock("../use-music-preferences", () => ({
  useMusicPreferences: () => mockPreferencesQuery,
  useUpdateMusicPreferences: () => ({ mutateAsync: mockUpdate }),
}));
jest.mock("../use-auth", () => ({ useCurrentUser: () => ({ id: mockUserId }) }));
jest.mock("../use-online-status", () => ({ useOnlineStatus: () => mockOnline }));
jest.mock("../use-toast", () => ({ useToast: () => ({ error: mockToastError }) }));
jest.mock("@/src/i18n/use-locale", () => ({ useLocale: () => ({ resolvedLanguage: "en" }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/src/experience", () => ({
  useCompletePreferenceNudge: () => ({ mutateAsync: mockCompleteNudge }),
  useExperienceState: () => mockExperienceState,
  trackProductEvent: (...args: unknown[]) => mockTrackProductEvent(...args),
}));

beforeEach(() => {
  mockOnline = true;
  mockUserId = "user-a";
  mockUpdate.mockReset().mockResolvedValue(undefined);
  mockCompleteNudge.mockReset().mockResolvedValue(undefined);
  mockTrackProductEvent.mockReset();
  mockExperienceState = {
    data: { preferenceNudgeStatus: "shown" },
    isLoading: false,
    isError: false,
  };
  mockToastError.mockReset();
  mockSetQueryData.mockReset();
  mockCancelQueries.mockReset().mockResolvedValue(undefined);
  mockInvalidateQueries.mockReset().mockResolvedValue(undefined);
  mockRefetch.mockReset();
  mockPreferencesQuery = {
    data: { genres: [], excludedMoods: [], atmosphere: "balanced" },
    isPending: false,
    fetchStatus: "idle",
    isError: false,
    refetch: mockRefetch,
  };
});

afterEach(() => disposePreferenceCommitQueues(mockQueryClient as never));

test("rejects new favorites beyond five while allowing an existing favorite to be removed", async () => {
  mockPreferencesQuery.data = {
    genres: ["Ambient", "House", "Jazz", "Pop", "Rock"],
    excludedMoods: [],
    atmosphere: "balanced",
  };
  const hook = await renderHook(() => useMusicPreferencesController());

  await act(async () => {
    expect(hook.result.current.toggleGenre("Soul")).toEqual({ accepted: false, reason: "limit" });
    expect(hook.result.current.toggleGenre("Jazz")).toEqual({ accepted: true });
    await Promise.resolve();
  });
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
    genres: ["Ambient", "House", "Pop", "Rock"],
  })));
  await waitFor(() => expect(mockInvalidateQueries).toHaveBeenCalledTimes(1));
});

test("preserves a legacy over-limit array for removal but never adds another value", async () => {
  mockPreferencesQuery.data = {
    genres: ["Ambient", "House", "Jazz", "Pop", "Rock", "Soul"],
    excludedMoods: ["Calm", "Focus", "Dreamy", "Warm"],
    atmosphere: "balanced",
  };
  const hook = await renderHook(() => useMusicPreferencesController());

  await act(async () => {
    expect(hook.result.current.toggleGenre("Funk")).toEqual({ accepted: false, reason: "limit" });
    expect(hook.result.current.toggleExcludedMood("Uplifting")).toEqual({ accepted: false, reason: "limit" });
    expect(hook.result.current.toggleExcludedMood("Dreamy")).toEqual({ accepted: true });
    await Promise.resolve();
  });
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
    excludedMoods: ["Calm", "Focus", "Warm"],
  })));
  await waitFor(() => expect(mockInvalidateQueries).toHaveBeenCalledTimes(1));
});

test("keeps cached preferences readable offline without queuing a mutation", async () => {
  mockOnline = false;
  const hook = await renderHook(() => useMusicPreferencesController());

  expect(hook.result.current.prefs).toEqual(mockPreferencesQuery.data);
  await act(async () => {
    expect(hook.result.current.toggleGenre("Ambient")).toEqual({ accepted: false, reason: "offline" });
  });
  expect(mockUpdate).not.toHaveBeenCalled();
  expect(mockToastError).toHaveBeenCalledWith("common.errors.offline", "common.errors.reconnect");
});

test("serializes cumulative edits across a remount", async () => {
  const first = deferred<void>();
  const second = deferred<void>();
  mockUpdate.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
  const firstVisit = await renderHook(() => useMusicPreferencesController());

  await act(async () => {
    firstVisit.result.current.toggleGenre("Ambient");
    firstVisit.result.current.toggleGenre("House");
    await Promise.resolve();
  });
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  await firstVisit.unmount();
  await renderHook(() => useMusicPreferencesController());

  await act(async () => {
    first.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
  expect(mockUpdate).toHaveBeenLastCalledWith({
    genres: ["Ambient", "House"],
    excludedMoods: [],
    atmosphere: "balanced",
  });
  await act(async () => {
    second.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() => expect(mockInvalidateQueries).toHaveBeenCalledTimes(1));
});

test("rolls back a failed head while preserving a newer local intent", async () => {
  const first = deferred<void>();
  const second = deferred<void>();
  mockUpdate.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
  const hook = await renderHook(() => useMusicPreferencesController());

  await act(async () => {
    hook.result.current.toggleGenre("Ambient");
    hook.result.current.toggleGenre("House");
    await Promise.resolve();
  });
  await act(async () => {
    first.reject(new Error("failed"));
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
  expect(mockSetQueryData).toHaveBeenLastCalledWith(
    ["music-preferences", "user-a"],
    { genres: ["House"], excludedMoods: [], atmosphere: "balanced" },
  );
  await act(async () => {
    second.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() => expect(mockInvalidateQueries).toHaveBeenCalledTimes(1));
});

test("announces saving then saved and completes the nudge with bucket-only analytics", async () => {
  const save = deferred<void>();
  mockUpdate.mockImplementationOnce(() => save.promise);
  const hook = await renderHook(() => useMusicPreferencesController());

  await act(async () => {
    hook.result.current.setAtmosphere("calm");
    await Promise.resolve();
  });
  expect(hook.result.current.saveStatus).toBe("saving");
  await act(async () => {
    save.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() => expect(hook.result.current.saveStatus).toBe("saved"));
  expect(mockCompleteNudge).toHaveBeenCalledWith(undefined);
  expect(mockTrackProductEvent).toHaveBeenCalledWith("music_preferences_saved", {
    flowVersion: 1,
    platform: expect.any(String),
    locale: "en",
    selectedCountBucket: "0",
  });
});

test("does not complete a terminal nudge after a later successful preference save", async () => {
  mockExperienceState = {
    data: { preferenceNudgeStatus: "completed" },
    isLoading: false,
    isError: false,
  };
  const hook = await renderHook(() => useMusicPreferencesController());

  await act(async () => {
    hook.result.current.setAtmosphere("calm");
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() => expect(hook.result.current.saveStatus).toBe("saved"));

  expect(mockCompleteNudge).not.toHaveBeenCalled();
});

test("completes the current nudge once for each authenticated user after an auth switch", async () => {
  const hook = await renderHook(() => useMusicPreferencesController());

  await act(async () => {
    hook.result.current.setAtmosphere("calm");
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() => expect(mockCompleteNudge).toHaveBeenCalledTimes(1));

  mockUserId = "user-b";
  await hook.rerender();
  await act(async () => {
    hook.result.current.setAtmosphere("intense");
    await Promise.resolve();
    await Promise.resolve();
  });

  await waitFor(() => expect(mockCompleteNudge).toHaveBeenCalledTimes(2));
  expect(mockInvalidateQueries).toHaveBeenCalledWith({
    queryKey: ["music-preferences", "user-b"],
  });
});

test("does not complete the nudge for an offline preference edit", async () => {
  mockOnline = false;
  const hook = await renderHook(() => useMusicPreferencesController());

  await act(async () => {
    hook.result.current.setAtmosphere("calm");
  });

  expect(mockCompleteNudge).not.toHaveBeenCalled();
});

test("auth-scope disposal makes a late save completion invisible", async () => {
  const save = deferred<void>();
  mockUpdate.mockImplementationOnce(() => save.promise);
  const hook = await renderHook(() => useMusicPreferencesController());

  await act(async () => {
    hook.result.current.setAtmosphere("intense");
    await Promise.resolve();
  });
  disposePreferenceCommitQueues(mockQueryClient as never);
  await act(async () => {
    save.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mockCompleteNudge).not.toHaveBeenCalled();
  expect(mockTrackProductEvent).not.toHaveBeenCalled();
});
