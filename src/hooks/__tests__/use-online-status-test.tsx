import { onlineManager } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import { useOnlineStatus } from "../use-online-status";

let originalOnline: boolean;

beforeEach(() => {
  originalOnline = onlineManager.isOnline();
});

afterEach(() => {
  onlineManager.setOnline(originalOnline);
});

test("reacts to TanStack onlineManager state changes", async () => {
  onlineManager.setOnline(true);
  const { result, unmount } = await renderHook(() => useOnlineStatus());
  expect(result.current).toBe(true);

  await act(() => onlineManager.setOnline(false));
  expect(result.current).toBe(false);

  await act(() => onlineManager.setOnline(true));
  expect(result.current).toBe(true);
  await unmount();
});
