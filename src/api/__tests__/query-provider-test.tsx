import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import {
  focusManager,
  onlineManager,
  useQueryClient,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { QueryProvider } from "../query-provider";

let mockNetInfoListener: ((state: NetInfoState) => void) | undefined;
const mockNetInfoUnsubscribe = jest.fn();

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn((listener: (state: NetInfoState) => void) => {
      mockNetInfoListener = listener;
      return mockNetInfoUnsubscribe;
    }),
  },
}));

const originalExpoOs = process.env.EXPO_OS;
const originalOnline = onlineManager.isOnline();
const originalFocused = focusManager.isFocused();

afterEach(() => {
  process.env.EXPO_OS = originalExpoOs;
  onlineManager.setOnline(originalOnline);
  focusManager.setFocused(originalFocused);
  jest.restoreAllMocks();
  mockNetInfoUnsubscribe.mockClear();
});

test("forwards NetInfo offline and online events to TanStack onlineManager", async () => {
  expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);
  expect(mockNetInfoListener).toBeDefined();

  await act(() => {
    mockNetInfoListener!({ isConnected: false } as NetInfoState);
  });
  expect(onlineManager.isOnline()).toBe(false);

  await act(() => {
    mockNetInfoListener!({ isConnected: true } as NetInfoState);
  });
  expect(onlineManager.isOnline()).toBe(true);
});

test("forwards native AppState changes to focusManager and removes the listener", async () => {
  process.env.EXPO_OS = "ios";
  let appStateListener: ((status: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListener = listener;
    return { remove };
  });

  const { result, unmount } = await renderHook(() => useQueryClient(), {
    wrapper: QueryProvider,
  });
  expect(result.current).toBeDefined();
  await waitFor(() => expect(appStateListener).toBeDefined());

  await act(() => appStateListener!("background"));
  expect(focusManager.isFocused()).toBe(false);
  await act(() => appStateListener!("active"));
  expect(focusManager.isFocused()).toBe(true);

  await unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});
