import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import { useLocalDate } from "../use-local-date";

describe("useLocalDate", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 2, 7, 23, 59, 59, 900));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("advances at the next local midnight and clears its timer on unmount", async () => {
    const clearTimeoutSpy = jest.spyOn(globalThis, "clearTimeout");
    const hook = await renderHook(() => useLocalDate());

    expect(hook.result.current).toBe("2026-03-07");

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(hook.result.current).toBe("2026-03-08");
    await hook.unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("rechecks a missed midnight when the app becomes active", async () => {
    let listener: ((status: AppStateStatus) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, next) => {
      listener = next;
      return { remove };
    });
    const hook = await renderHook(() => useLocalDate());

    jest.setSystemTime(new Date(2026, 2, 9, 8));
    await act(async () => listener?.("active"));

    expect(hook.result.current).toBe("2026-03-09");
    await hook.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
