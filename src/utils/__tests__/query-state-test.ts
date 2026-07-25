import { isInitialQueryLoading } from "@/src/utils/query-state";

describe("isInitialQueryLoading", () => {
  it.each(["fetching", "paused"] as const)(
    "shows an unresolved %s request",
    (fetchStatus) => {
      expect(
        isInitialQueryLoading({
          data: undefined,
          isPending: true,
          fetchStatus,
        }),
      ).toBe(true);
    },
  );

  it("does not show for a disabled idle query", () => {
    expect(
      isInitialQueryLoading({
        data: undefined,
        isPending: true,
        fetchStatus: "idle",
      }),
    ).toBe(false);
  });

  it("keeps cached data visible during a refetch", () => {
    expect(
      isInitialQueryLoading({
        data: [{ id: "cached" }],
        isPending: false,
        fetchStatus: "fetching",
      }),
    ).toBe(false);
  });

  it("stops after a settled empty response", () => {
    expect(
      isInitialQueryLoading({
        data: [],
        isPending: false,
        fetchStatus: "idle",
      }),
    ).toBe(false);
  });

  it("does not show after an unresolved query settles with an error", () => {
    expect(
      isInitialQueryLoading({
        data: undefined,
        isPending: false,
        fetchStatus: "idle",
      }),
    ).toBe(false);
  });
});
