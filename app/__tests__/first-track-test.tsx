import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { StyleSheet as RNStyleSheet } from "react-native";

import FirstTrackScreen, {
  resolveFirstTrackDestination,
} from "@/app/first-track";
import { PostAuthIntentRouter } from "@/src/experience/PostAuthIntentRouter";
import { fetchOwnedDjs } from "@/src/hooks/use-owned-djs";
import i18n from "@/src/i18n";

type OwnedDjsQuery = {
  data: readonly { id: string }[] | undefined;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: jest.Mock;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function query(
  overrides: Partial<OwnedDjsQuery> = {},
): OwnedDjsQuery {
  return {
    data: undefined,
    isPending: true,
    isError: false,
    isSuccess: false,
    refetch: jest.fn(async () => undefined),
    ...overrides,
  };
}

let mockCurrentUser: { id: string } | null = { id: "user-a" };
let mockOwnedDjsQuery = query();
let mockWindow = { width: 390, height: 844, fontScale: 1 };
let mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const mockRouterReplace = jest.fn();
const mockPendingRead = jest.fn();
const mockPendingConsume = jest.fn();
const mockPendingClear = jest.fn();
const mockSyncIntro = jest.fn();
const mockTrackProductEvent = jest.fn();
const validPendingIntent = {
  version: 1 as const,
  kind: "first_track" as const,
  source: "public_intro_v2" as const,
  createdAt: "2026-08-25T12:00:00.000Z",
};
let mockDjsResponse: {
  data: readonly {
    id: string;
    name: string;
    created_at: string;
    owner_id: string;
  }[] | null;
  error: unknown | null;
} = { data: [], error: null };

const mockDjsBuilder = {
  select: jest.fn(),
  eq: jest.fn(),
  order: jest.fn(),
  returns: jest.fn(),
};
mockDjsBuilder.select.mockReturnValue(mockDjsBuilder);
mockDjsBuilder.eq.mockReturnValue(mockDjsBuilder);
mockDjsBuilder.order.mockReturnValue(mockDjsBuilder);
mockDjsBuilder.returns.mockImplementation(async () => mockDjsResponse);
const mockFrom = jest.fn((_table: string) => mockDjsBuilder);

jest.mock("@/src/api/supabase", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

jest.mock("@/src/hooks/use-auth", () => ({
  useCurrentUser: () => mockCurrentUser,
}));

jest.mock("@/src/hooks/use-owned-djs", () => {
  const actual = jest.requireActual("@/src/hooks/use-owned-djs");
  return {
    ...actual,
    useOwnedDjs: () => mockOwnedDjsQuery,
  };
});

jest.mock("@/src/experience", () => ({
  PUBLIC_INTRO_VERSION: 2,
  pendingIntentStore: {
    read: (...args: unknown[]) => mockPendingRead(...args),
    consume: (...args: unknown[]) => mockPendingConsume(...args),
    clear: (...args: unknown[]) => mockPendingClear(...args),
  },
  trackProductEvent: (...args: unknown[]) => mockTrackProductEvent(...args),
  useSyncIntroVersion: () => ({ mutateAsync: mockSyncIntro }),
}));

jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({
    ...mockWindow,
    scale: 1,
  }),
}));

describe("owned DJ resolution", () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockDjsBuilder.select.mockClear();
    mockDjsBuilder.eq.mockClear();
    mockDjsBuilder.order.mockClear();
    mockDjsBuilder.returns.mockClear();
    mockDjsBuilder.returns.mockImplementation(async () => mockDjsResponse);
    mockDjsResponse = { data: [], error: null };
  });

  it("filters the deterministic DJ query to the authenticated owner", async () => {
    mockDjsResponse = {
      data: [{
        id: "dj-1",
        name: "First DJ",
        created_at: "2026-08-25T12:00:00.000Z",
        owner_id: "user-a",
      }],
      error: null,
    };

    await expect(fetchOwnedDjs("user-a")).resolves.toEqual(mockDjsResponse.data);

    expect(mockFrom).toHaveBeenCalledWith("djs");
    expect(mockDjsBuilder.select).toHaveBeenCalledWith(
      "id, name, created_at, owner_id",
    );
    expect(mockDjsBuilder.eq).toHaveBeenCalledWith("owner_id", "user-a");
    expect(mockDjsBuilder.order).toHaveBeenNthCalledWith(
      1,
      "created_at",
      { ascending: true },
    );
    expect(mockDjsBuilder.order).toHaveBeenNthCalledWith(
      2,
      "id",
      { ascending: true },
    );
  });

  it("throws the owner-filtered query failure instead of treating it as empty", async () => {
    const failure = new Error("query unavailable");
    mockDjsResponse = { data: null, error: failure };

    await expect(fetchOwnedDjs("user-a")).rejects.toBe(failure);
  });

  it("resolves empty, one-DJ, and anomalous multi-DJ outcomes", () => {
    expect(resolveFirstTrackDestination([])).toEqual({ kind: "create_dj" });
    expect(resolveFirstTrackDestination([{ id: "dj-1" }])).toEqual({
      kind: "create_track",
      djId: "dj-1",
      anomaly: false,
    });
    expect(resolveFirstTrackDestination([
      { id: "dj-1" },
      { id: "dj-2" },
    ])).toEqual({
      kind: "create_track",
      djId: "dj-1",
      anomaly: true,
    });
  });
});

describe("FirstTrackGate", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mockCurrentUser = { id: "user-a" };
    mockOwnedDjsQuery = query();
    mockWindow = { width: 390, height: 844, fontScale: 1 };
    mockInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    mockRouterReplace.mockClear();
    mockPendingRead.mockReset().mockResolvedValue(validPendingIntent);
    mockPendingConsume.mockReset().mockResolvedValue(true);
    mockPendingClear.mockReset().mockResolvedValue(undefined);
    mockTrackProductEvent.mockReset().mockResolvedValue(undefined);
  });

  it("keeps the intent unresolved while the owner query loads", async () => {
    const screen = await render(<FirstTrackScreen />);

    expect(screen.getByRole("progressbar", { name: "Checking your DJs" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveStyle({
      minHeight: 44,
      minWidth: 44,
    });
    expect(mockPendingConsume).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("waits for durable intent validation before resolving a successful empty DJ query", async () => {
    const reading = deferred<typeof validPendingIntent | null>();
    mockPendingRead.mockReturnValue(reading.promise);
    mockOwnedDjsQuery = query({
      data: [],
      isPending: false,
      isSuccess: true,
    });

    await render(<FirstTrackScreen />);

    expect(mockPendingRead).toHaveBeenCalledWith(expect.any(Number));
    expect(mockRouterReplace).not.toHaveBeenCalled();

    await act(async () => reading.resolve(validPendingIntent));
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: "/create-dj",
      params: { returnIntent: "first_track" },
    }));
    expect(mockPendingRead.mock.invocationCallOrder[0]).toBeLessThan(
      mockRouterReplace.mock.invocationCallOrder[0],
    );
  });

  it.each([
    "missing direct intent",
    "expired intent normalized by storage",
    "malformed intent normalized by storage",
  ])("replaces Home for a %s", async () => {
    mockPendingRead.mockResolvedValue(null);
    mockOwnedDjsQuery = query({
      data: [],
      isPending: false,
      isSuccess: true,
    });

    await render(<FirstTrackScreen />);

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith("/(app)"));
    expect(mockPendingConsume).not.toHaveBeenCalled();
    expect(mockTrackProductEvent).not.toHaveBeenCalledWith(
      "first_track_gate_resolved",
      expect.anything(),
    );
  });

  it("shows retry UI when durable intent storage rejects and deduplicates the retry", async () => {
    const retryRead = deferred<typeof validPendingIntent | null>();
    mockPendingRead
      .mockRejectedValueOnce(new Error("storage unavailable"))
      .mockReturnValueOnce(retryRead.promise);
    mockOwnedDjsQuery = query({
      data: [],
      isPending: false,
      isSuccess: true,
    });
    const screen = await render(<FirstTrackScreen />);
    const retry = await waitFor(() => screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("We couldn't finish this step")).toBeTruthy();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    await fireEvent.press(retry);
    await fireEvent.press(retry);
    expect(mockPendingRead).toHaveBeenCalledTimes(2);

    await act(async () => retryRead.resolve(validPendingIntent));
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: "/create-dj",
      params: { returnIntent: "first_track" },
    }));
  });

  it("shows a retryable query failure without interpreting it as no DJs", async () => {
    mockOwnedDjsQuery = query({ isPending: false, isError: true });
    const screen = await render(<FirstTrackScreen />);

    expect(screen.getByRole("alert")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toHaveStyle({ minHeight: 44, minWidth: 44 });
    await fireEvent.press(retry);

    expect(mockOwnedDjsQuery.refetch).toHaveBeenCalledTimes(1);
    expect(mockPendingConsume).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("hands an empty successful result to Create DJ without consuming intent", async () => {
    mockOwnedDjsQuery = query({
      data: [],
      isPending: false,
      isSuccess: true,
    });

    await render(<FirstTrackScreen />);

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: "/create-dj",
      params: { returnIntent: "first_track" },
    }));
    expect(mockPendingRead).toHaveBeenCalledTimes(1);
    expect(mockPendingRead.mock.invocationCallOrder[0]).toBeLessThan(
      mockRouterReplace.mock.invocationCallOrder[0],
    );
    expect(mockPendingConsume).not.toHaveBeenCalled();
    expect(mockTrackProductEvent).toHaveBeenCalledWith(
      "first_track_gate_resolved",
      expect.objectContaining({ routeOutcome: "create_dj" }),
    );
  });

  it("consumes an owned-DJ intent before replacing to Create Track", async () => {
    const consumption = deferred<boolean>();
    mockPendingConsume.mockReturnValue(consumption.promise);
    mockOwnedDjsQuery = query({
      data: [{ id: "dj-1" }],
      isPending: false,
      isSuccess: true,
    });

    await render(<FirstTrackScreen />);
    await waitFor(() => expect(mockPendingConsume).toHaveBeenCalledWith(
      "first_track",
      expect.any(Number),
    ));
    expect(mockPendingRead.mock.invocationCallOrder[0]).toBeLessThan(
      mockPendingConsume.mock.invocationCallOrder[0],
    );
    expect(mockRouterReplace).not.toHaveBeenCalled();

    await act(async () => consumption.resolve(true));

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: "/create-track",
      params: { djId: "dj-1" },
    }));
    expect(mockPendingConsume.mock.invocationCallOrder[0]).toBeLessThan(
      mockRouterReplace.mock.invocationCallOrder[0],
    );
    expect(mockTrackProductEvent).toHaveBeenCalledWith(
      "first_track_gate_resolved",
      expect.objectContaining({ routeOutcome: "create_track" }),
    );
  });

  it("replaces Home without telemetry when owned-intent consumption resolves false", async () => {
    mockPendingConsume.mockResolvedValue(false);
    mockOwnedDjsQuery = query({
      data: [{ id: "dj-1" }],
      isPending: false,
      isSuccess: true,
    });

    const screen = await render(<FirstTrackScreen />);

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith("/(app)"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mockPendingConsume).toHaveBeenCalledTimes(1);
    expect(mockPendingClear).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalledWith({
      pathname: "/create-track",
      params: { djId: "dj-1" },
    });
    expect(mockTrackProductEvent).not.toHaveBeenCalledWith(
      "first_track_gate_resolved",
      expect.anything(),
    );
  });

  it("deduplicates a rejected consume retry and routes only after true", async () => {
    const retryConsumption = deferred<boolean>();
    mockPendingConsume
      .mockRejectedValueOnce(new Error("storage unavailable"))
      .mockReturnValueOnce(retryConsumption.promise);
    mockOwnedDjsQuery = query({
      data: [{ id: "dj-1" }],
      isPending: false,
      isSuccess: true,
    });
    const screen = await render(<FirstTrackScreen />);
    const retry = await waitFor(() => screen.getByRole("button", { name: "Retry" }));

    await fireEvent.press(retry);
    await fireEvent.press(retry);

    expect(mockPendingConsume).toHaveBeenCalledTimes(2);
    expect(mockRouterReplace).not.toHaveBeenCalled();
    await act(async () => retryConsumption.resolve(true));

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: "/create-track",
      params: { djId: "dj-1" },
    }));
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockTrackProductEvent).toHaveBeenCalledTimes(1);
  });

  it("suppresses a successful consume retry after the auth scope changes", async () => {
    const retryConsumption = deferred<boolean>();
    mockPendingConsume
      .mockRejectedValueOnce(new Error("storage unavailable"))
      .mockReturnValueOnce(retryConsumption.promise);
    mockOwnedDjsQuery = query({
      data: [{ id: "dj-a" }],
      isPending: false,
      isSuccess: true,
    });
    const screen = await render(<FirstTrackScreen />);
    const retry = await waitFor(() => screen.getByRole("button", { name: "Retry" }));

    await fireEvent.press(retry);
    mockCurrentUser = { id: "user-b" };
    mockOwnedDjsQuery = query();
    await screen.rerender(<FirstTrackScreen />);
    await act(async () => retryConsumption.resolve(true));

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockTrackProductEvent).not.toHaveBeenCalled();
  });

  it("suppresses a successful consume retry after the gate unmounts", async () => {
    const retryConsumption = deferred<boolean>();
    mockPendingConsume
      .mockRejectedValueOnce(new Error("storage unavailable"))
      .mockReturnValueOnce(retryConsumption.promise);
    mockOwnedDjsQuery = query({
      data: [{ id: "dj-a" }],
      isPending: false,
      isSuccess: true,
    });
    const screen = await render(<FirstTrackScreen />);
    const retry = await waitFor(() => screen.getByRole("button", { name: "Retry" }));

    await fireEvent.press(retry);
    await screen.unmount();
    await act(async () => retryConsumption.resolve(true));

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockTrackProductEvent).not.toHaveBeenCalled();
  });

  it("uses the first deterministic DJ and emits bounded anomaly telemetry", async () => {
    mockOwnedDjsQuery = query({
      data: [{ id: "dj-1" }, { id: "dj-2" }],
      isPending: false,
      isSuccess: true,
    });

    await render(<FirstTrackScreen />);

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: "/create-track",
      params: { djId: "dj-1" },
    }));
    expect(mockTrackProductEvent).toHaveBeenCalledWith(
      "first_track_gate_resolved",
      expect.objectContaining({ routeOutcome: "multiple_djs_create_track" }),
    );
  });

  it("clears explicit cancellation before replacing Home", async () => {
    const clearing = deferred<void>();
    mockPendingClear.mockReturnValue(clearing.promise);
    const screen = await render(<FirstTrackScreen />);

    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(mockPendingClear).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).not.toHaveBeenCalled();

    await act(async () => clearing.resolve(undefined));

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith("/(app)"));
    expect(mockTrackProductEvent).toHaveBeenCalledWith(
      "first_track_intent_cancelled",
      expect.objectContaining({ routeOutcome: "home" }),
    );
  });

  it("requires a successful clear and deduplicates retry with Cancel-again", async () => {
    const consumption = deferred<boolean>();
    const retryClear = deferred<void>();
    mockPendingConsume.mockReturnValue(consumption.promise);
    mockPendingClear
      .mockRejectedValueOnce(new Error("storage unavailable"))
      .mockReturnValueOnce(retryClear.promise);
    mockOwnedDjsQuery = query({
      data: [{ id: "dj-a" }],
      isPending: false,
      isSuccess: true,
    });
    const screen = await render(<FirstTrackScreen />);
    await waitFor(() => expect(mockPendingConsume).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    const retry = await waitFor(() => screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("We couldn't finish this step")).toBeTruthy();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockTrackProductEvent).not.toHaveBeenCalled();

    await fireEvent.press(retry);
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(mockPendingClear).toHaveBeenCalledTimes(2);

    await act(async () => consumption.resolve(true));
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockTrackProductEvent).not.toHaveBeenCalledWith(
      "first_track_gate_resolved",
      expect.anything(),
    );

    await act(async () => retryClear.resolve(undefined));
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith("/(app)"));
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockTrackProductEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackProductEvent).toHaveBeenCalledWith(
      "first_track_intent_cancelled",
      expect.objectContaining({ routeOutcome: "home" }),
    );
  });

  it("suppresses a successful clear retry after the auth scope changes", async () => {
    const retryClear = deferred<void>();
    mockPendingClear
      .mockRejectedValueOnce(new Error("storage unavailable"))
      .mockReturnValueOnce(retryClear.promise);
    const screen = await render(<FirstTrackScreen />);

    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    const retry = await waitFor(() => screen.getByRole("button", { name: "Retry" }));
    await fireEvent.press(retry);

    mockCurrentUser = { id: "user-b" };
    mockOwnedDjsQuery = query();
    await screen.rerender(<FirstTrackScreen />);
    await act(async () => retryClear.resolve(undefined));

    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockTrackProductEvent).not.toHaveBeenCalled();
  });

  it("does not let late owned-intent consumption overwrite explicit cancellation", async () => {
    const consumption = deferred<boolean>();
    mockPendingConsume.mockReturnValue(consumption.promise);
    mockOwnedDjsQuery = query({
      data: [{ id: "dj-a" }],
      isPending: false,
      isSuccess: true,
    });
    const screen = await render(<FirstTrackScreen />);
    await waitFor(() => expect(mockPendingConsume).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith("/(app)"));

    await act(async () => consumption.resolve(true));

    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).not.toHaveBeenCalledWith({
      pathname: "/create-track",
      params: { djId: "dj-a" },
    });
  });

  it("suppresses duplicate and late owned-DJ navigation after an auth switch", async () => {
    const consumption = deferred<boolean>();
    mockPendingConsume.mockReturnValue(consumption.promise);
    mockOwnedDjsQuery = query({
      data: [{ id: "dj-a" }],
      isPending: false,
      isSuccess: true,
    });
    const screen = await render(<FirstTrackScreen />);
    await waitFor(() => expect(mockPendingConsume).toHaveBeenCalledTimes(1));

    await screen.rerender(<FirstTrackScreen />);
    expect(mockPendingConsume).toHaveBeenCalledTimes(1);

    mockCurrentUser = { id: "user-b" };
    mockOwnedDjsQuery = query();
    await screen.rerender(<FirstTrackScreen />);
    await act(async () => consumption.resolve(true));

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("suppresses navigation when the gate unmounts during consumption", async () => {
    const consumption = deferred<boolean>();
    mockPendingConsume.mockReturnValue(consumption.promise);
    mockOwnedDjsQuery = query({
      data: [{ id: "dj-a" }],
      isPending: false,
      isSuccess: true,
    });
    const screen = await render(<FirstTrackScreen />);
    await waitFor(() => expect(mockPendingConsume).toHaveBeenCalledTimes(1));

    await screen.unmount();
    await act(async () => consumption.resolve(true));

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("uses a four-edge safe-area scroll flow with a bounded readable card", async () => {
    mockInsets = { top: 11, right: 22, bottom: 33, left: 44 };
    const screen = await render(<FirstTrackScreen />);
    const contentStyle = RNStyleSheet.flatten(
      screen.getByTestId("first-track-scroll").props.contentContainerStyle,
    );
    const cardStyle = RNStyleSheet.flatten(
      screen.getByTestId("first-track-card").props.style,
    );

    expect(contentStyle.paddingTop).toBeGreaterThan(mockInsets.top);
    expect(contentStyle.paddingRight).toBeGreaterThan(mockInsets.right);
    expect(contentStyle.paddingBottom).toBeGreaterThan(mockInsets.bottom);
    expect(contentStyle.paddingLeft).toBeGreaterThan(mockInsets.left);
    expect(cardStyle).toEqual(expect.objectContaining({ width: "100%", maxWidth: 560 }));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("keeps the gate heading and state before the cancel action", async () => {
    const screen = await render(<FirstTrackScreen />);
    const renderedTree = JSON.stringify(screen.toJSON());
    const positions = [
      "first-track-heading",
      "first-track-state",
      "first-track-action",
    ].map((testID) => renderedTree.indexOf(`\"testID\":\"${testID}\"`));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
    expect(screen.getByTestId("first-track-heading")).toHaveProp(
      "accessibilityRole",
      "header",
    );
  });

  it.each([
    { height: 384, fontScale: 1.5 },
    { height: 844, fontScale: 2 },
  ])(
    "top-aligns the scroll flow at $height px and font scale $fontScale",
    async ({ height, fontScale }) => {
      mockWindow = { width: 720, height, fontScale };
      const screen = await render(<FirstTrackScreen />);

      expect(
        RNStyleSheet.flatten(
          screen.getByTestId("first-track-scroll").props.contentContainerStyle,
        ),
      ).toEqual(expect.objectContaining({ justifyContent: "flex-start" }));
      expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    },
  );

  it("does not repeat intent consumption when only dimensions or font scale change", async () => {
    const consumption = deferred<boolean>();
    mockPendingConsume.mockReturnValue(consumption.promise);
    mockOwnedDjsQuery = query({
      data: [{ id: "dj-a" }],
      isPending: false,
      isSuccess: true,
    });
    const screen = await render(<FirstTrackScreen />);
    await waitFor(() => expect(mockPendingConsume).toHaveBeenCalledTimes(1));

    mockWindow = { width: 720, height: 384, fontScale: 1.5 };
    await screen.rerender(<FirstTrackScreen />);
    mockWindow = { width: 1280, height: 800, fontScale: 2 };
    await screen.rerender(<FirstTrackScreen />);

    expect(mockPendingConsume).toHaveBeenCalledTimes(1);
    await act(async () => consumption.resolve(true));
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledTimes(1));
  });

  it("localizes loading, query failure, retry, and cancel actions in Spanish", async () => {
    await i18n.changeLanguage("es");
    const loading = await render(<FirstTrackScreen />);
    expect(loading.getByRole("progressbar", { name: "Revisando tus DJs" })).toBeTruthy();
    expect(loading.getByText("Revisando tus DJs")).toBeTruthy();
    expect(loading.getByRole("button", { name: "Cancelar" })).toBeTruthy();
    await loading.unmount();

    mockOwnedDjsQuery = query({ isPending: false, isError: true });
    const failure = await render(<FirstTrackScreen />);
    expect(failure.getByText("No pudimos revisar tus DJs")).toBeTruthy();
    const retry = failure.getByRole("button", { name: "Reintentar" });
    await fireEvent.press(retry);
    expect(mockOwnedDjsQuery.refetch).toHaveBeenCalledTimes(1);
    expect(failure.getByRole("button", { name: "Cancelar" })).toBeTruthy();
  });

  it("localizes storage failure and retry action in Spanish", async () => {
    await i18n.changeLanguage("es");
    mockPendingConsume.mockRejectedValue(new Error("storage unavailable"));
    mockOwnedDjsQuery = query({
      data: [{ id: "dj-a" }],
      isPending: false,
      isSuccess: true,
    });
    const screen = await render(<FirstTrackScreen />);

    await waitFor(() => {
      expect(screen.getByText("No pudimos completar este paso")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
  });
});

describe("PostAuthIntentRouter", () => {
  beforeEach(() => {
    mockCurrentUser = null;
    mockRouterReplace.mockClear();
    mockPendingRead.mockReset().mockResolvedValue(null);
    mockPendingConsume.mockReset();
    mockPendingClear.mockReset();
    mockSyncIntro.mockReset().mockResolvedValue(undefined);
    mockTrackProductEvent.mockReset().mockResolvedValue(undefined);
  });

  it("leaves pending storage untouched when authentication is absent", async () => {
    await render(<PostAuthIntentRouter />);

    expect(mockPendingRead).not.toHaveBeenCalled();
    expect(mockPendingConsume).not.toHaveBeenCalled();
    expect(mockPendingClear).not.toHaveBeenCalled();
    expect(mockSyncIntro).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("reads once, syncs intro v2, emits auth success, and routes a current intent once", async () => {
    const reading = deferred<{
      version: 1;
      kind: "first_track";
      source: "public_intro_v2";
      createdAt: string;
    } | null>();
    mockCurrentUser = { id: "user-a" };
    mockPendingRead.mockReturnValue(reading.promise);
    const screen = await render(<PostAuthIntentRouter />);

    await screen.rerender(<PostAuthIntentRouter />);
    expect(mockPendingRead).toHaveBeenCalledTimes(1);
    expect(mockSyncIntro).toHaveBeenCalledTimes(1);
    expect(mockSyncIntro).toHaveBeenCalledWith(2);
    expect(mockTrackProductEvent).toHaveBeenCalledWith(
      "auth_succeeded",
      expect.objectContaining({ flowVersion: 2 }),
    );
    expect(mockPendingRead.mock.invocationCallOrder[0]).toBeLessThan(
      mockSyncIntro.mock.invocationCallOrder[0],
    );

    await act(async () => reading.resolve({
      version: 1,
      kind: "first_track",
      source: "public_intro_v2",
      createdAt: "2026-08-25T12:00:00.000Z",
    }));

    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith("/first-track"));
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    expect(mockPendingConsume).not.toHaveBeenCalled();
    expect(mockPendingClear).not.toHaveBeenCalled();
  });

  it("does not route when the one pending-intent read fails", async () => {
    mockCurrentUser = { id: "user-a" };
    mockPendingRead.mockRejectedValue(new Error("storage unavailable"));

    await render(<PostAuthIntentRouter />);
    await act(async () => undefined);

    expect(mockPendingRead).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockPendingConsume).not.toHaveBeenCalled();
    expect(mockPendingClear).not.toHaveBeenCalled();
  });

  it("suppresses a late read from the previous authenticated user", async () => {
    const userARead = deferred<any>();
    const userBRead = deferred<any>();
    mockCurrentUser = { id: "user-a" };
    mockPendingRead
      .mockReturnValueOnce(userARead.promise)
      .mockReturnValueOnce(userBRead.promise);
    const screen = await render(<PostAuthIntentRouter />);

    mockCurrentUser = { id: "user-b" };
    await screen.rerender(<PostAuthIntentRouter />);
    await act(async () => userARead.resolve({
      version: 1,
      kind: "first_track",
      source: "public_intro_v2",
      createdAt: "2026-08-25T12:00:00.000Z",
    }));
    expect(mockRouterReplace).not.toHaveBeenCalled();

    await act(async () => userBRead.resolve(null));
    expect(mockPendingRead).toHaveBeenCalledTimes(2);
    expect(mockSyncIntro).toHaveBeenCalledTimes(2);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it("suppresses a late intent read after unmount", async () => {
    const reading = deferred<any>();
    mockCurrentUser = { id: "user-a" };
    mockPendingRead.mockReturnValue(reading.promise);
    const screen = await render(<PostAuthIntentRouter />);

    await screen.unmount();
    await act(async () => reading.resolve({
      version: 1,
      kind: "first_track",
      source: "public_intro_v2",
      createdAt: "2026-08-25T12:00:00.000Z",
    }));

    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});
