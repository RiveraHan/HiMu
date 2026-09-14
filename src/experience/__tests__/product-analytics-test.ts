import {
  parseProductEventEnvelope,
  type ProductEventEnvelope,
} from "../../../supabase/functions/product-events/handler";
import { secureStorage } from "@/src/lib/secure-storage";
import { randomUUID } from "expo-crypto";
import {
  createProductAnalyticsClient,
  createProductEventTransport,
  trackProductEvent,
  type ProductAnalyticsStorage,
} from "../product-analytics";

jest.mock("@/src/api/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { access_token: "verified-user-token" } },
        error: null,
      })),
    },
    functions: { invoke: jest.fn(async () => ({ error: null })) },
  },
}));
jest.mock("@/src/lib/secure-storage", () => ({
  secureStorage: { getItem: jest.fn(), setItem: jest.fn() },
}));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn() }));

const STORAGE_KEY = "himu.product-analytics.v1";
const UUIDS = Array.from(
  { length: 80 },
  (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);

const TRANSPORT_EVENT: ProductEventEnvelope = {
  eventId: "00000000-0000-4000-8000-000000000001",
  installationId: "00000000-0000-4000-8000-000000000002",
  sessionId: "00000000-0000-4000-8000-000000000003",
  name: "intro_viewed",
  occurredAt: "2026-08-25T12:00:00.000Z",
  properties: { flowVersion: 2, platform: "web", locale: "en" },
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function settleUntil(condition: () => boolean) {
  for (let index = 0; index < 2_000; index += 1) {
    if (condition()) return;
    await Promise.resolve();
  }
  throw new Error("condition did not settle");
}

function harness(options?: {
  transport?: (event: ProductEventEnvelope) => Promise<void>;
  setItem?: (key: string, value: string) => Promise<void>;
}) {
  const values = new Map<string, string>();
  const storage: ProductAnalyticsStorage = {
    getItem: jest.fn(async (key) => values.get(key) ?? null),
    setItem: jest.fn(options?.setItem ?? (async (key, value) => {
      values.set(key, value);
    })),
  };
  let nextUuid = 0;
  const transport = jest.fn(options?.transport ?? (async () => undefined));
  const client = createProductAnalyticsClient({
    storage,
    randomUUID: () => UUIDS[nextUuid++]!,
    now: () => new Date("2026-08-25T12:00:00.000Z"),
    transport,
  });

  return { client, storage, transport, values };
}

test("delivers a valid allowlisted event without creative or identity content", async () => {
  const { client, transport } = harness();

  await client.trackProductEvent("intro_step_viewed", {
    flowVersion: 2,
    platform: "web",
    locale: "es",
    step: "promise",
  });

  expect(transport).toHaveBeenCalledWith({
    eventId: UUIDS[2],
    installationId: UUIDS[0],
    sessionId: UUIDS[1],
    name: "intro_step_viewed",
    occurredAt: "2026-08-25T12:00:00.000Z",
    properties: {
      flowVersion: 2,
      platform: "web",
      locale: "es",
      step: "promise",
    },
  });
  expect(JSON.stringify(transport.mock.calls)).not.toMatch(
    /idea|title|lyrics|email|url|token|provider|djName|identityConcept/i,
  );
});

test("anonymous production transport sends only the public API key and no authorization", async () => {
  const invoke = jest.fn();
  const fetchRequest = jest.fn(async (
    _input: string,
    _init: {
      headers: { apikey: string; "Content-Type": "application/json" };
    },
  ) => ({ ok: true }));
  const transport = createProductEventTransport({
    functionUrl: "https://project.example/functions/v1/product-events",
    publicApiKey: "public-anon-key",
    accessToken: async () => null,
    invoke,
    fetch: fetchRequest,
  });

  await transport(TRANSPORT_EVENT);

  expect(invoke).not.toHaveBeenCalled();
  expect(fetchRequest).toHaveBeenCalledWith(
    "https://project.example/functions/v1/product-events",
    expect.objectContaining({
      method: "POST",
      headers: {
        apikey: "public-anon-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(TRANSPORT_EVENT),
    }),
  );
  const headers = fetchRequest.mock.calls[0]?.[1]?.headers as Record<string, string>;
  expect(Object.keys(headers).map((key) => key.toLowerCase())).not.toContain("authorization");
});

test("authenticated production transport invokes with the verified session access token", async () => {
  const invoke = jest.fn(async () => ({ error: null }));
  const fetchRequest = jest.fn();
  const transport = createProductEventTransport({
    functionUrl: "https://project.example/functions/v1/product-events",
    publicApiKey: "public-anon-key",
    accessToken: async () => "verified-user-token",
    invoke,
    fetch: fetchRequest,
  });

  await transport(TRANSPORT_EVENT);

  expect(fetchRequest).not.toHaveBeenCalled();
  expect(invoke).toHaveBeenCalledWith("product-events", {
    body: TRANSPORT_EVENT,
    headers: { Authorization: "Bearer verified-user-token" },
  });
});

test("rejects unknown events, unknown properties, and cross-event property values", async () => {
  const { client, storage, transport } = harness();

  await client.trackProductEvent("idea_captured" as never, {
    flowVersion: 2,
  });
  await client.trackProductEvent("intro_viewed", {
    idea: "a private creative direction",
  } as never);
  await client.trackProductEvent("intro_step_viewed", {
    step: "identity",
  } as never);

  expect(transport).not.toHaveBeenCalled();
  expect(storage.setItem).not.toHaveBeenCalled();
});

test("delivers a bounded Moment event without track content or share data", async () => {
  const { client, transport } = harness();

  await client.trackProductEvent("moment_feedback_answered", {
    trackId: "00000000-0000-4000-8000-000000000021",
    question: "surprised",
    answer: true,
    platform: "android",
    locale: "es",
  });

  expect(transport).toHaveBeenCalledWith(expect.objectContaining({
    name: "moment_feedback_answered",
    properties: {
      trackId: "00000000-0000-4000-8000-000000000021",
      question: "surprised",
      answer: true,
      platform: "android",
      locale: "es",
    },
  }));
  expect(JSON.stringify(transport.mock.calls)).not.toMatch(
    /title|artist|audio|url|recipient|clipboard|lyrics|prompt|rawError|freeText/i,
  );
});

test("the collector accepts each complete Moment schema and rejects missing required fields", () => {
  const trackId = "00000000-0000-4000-8000-000000000021";
  const cases = [
    ["moment_shown", { trackId, visibility: "private" }],
    ["moment_visibility_opened", { trackId, visibility: "public" }],
    ["moment_visibility_completed", { trackId, visibility: "public", elapsedMs: 12 }],
    ["moment_visibility_failed", { trackId, visibility: "private", errorCategory: "network" }],
    ["moment_share_selected", { trackId, shareMethod: "native_share" }],
    ["moment_share_outcome", { trackId, shareMethod: "clipboard", outcome: "copied" }],
    ["moment_feedback_answered", { trackId, question: "would_share", answer: false }],
  ] as const;

  for (const [index, [name, properties]] of cases.entries()) {
    const parsed = parseProductEventEnvelope({
      ...TRANSPORT_EVENT,
      eventId: UUIDS[index + 10],
      name,
      properties,
    });
    expect(parsed).toEqual(expect.objectContaining({ ok: true }));
  }

  expect(parseProductEventEnvelope({
    ...TRANSPORT_EVENT,
    name: "moment_feedback_answered",
    properties: { trackId, question: "surprised" },
  })).toEqual({ ok: false, code: "invalid_input" });
});

test("drops Moment events with unknown, creative, identifying, or cross-event properties", async () => {
  const { client, transport } = harness();
  const trackId = "00000000-0000-4000-8000-000000000021";

  await client.trackProductEvent("moment_feedback_answered", {
    trackId,
    question: "surprised",
    answer: true,
    title: "private title",
  } as never);
  await client.trackProductEvent("moment_share_outcome", {
    trackId,
    shareMethod: "clipboard",
    outcome: "copied",
    clipboard: "https://private.example/track",
  } as never);
  await client.trackProductEvent("moment_visibility_completed", {
    trackId,
    visibility: "public",
    answer: true,
  } as never);

  expect(transport).not.toHaveBeenCalled();
});

test("Moment event names and properties remain closed at compile time", () => {
  if (false) {
    void trackProductEvent("moment_shown", {
      trackId: "00000000-0000-4000-8000-000000000021",
      visibility: "private",
    });
    // @ts-expect-error Titles are never valid analytics properties.
    void trackProductEvent("moment_shown", { title: "private" });
    // @ts-expect-error Raw share URLs are never valid analytics properties.
    void trackProductEvent("moment_share_selected", { url: "https://private.example" });
  }

  expect(typeof trackProductEvent).toBe("function");
});

test("the public API rejects unknown event and property names at compile time", () => {
  if (false) {
    // @ts-expect-error Product telemetry has a closed event-name union.
    void trackProductEvent("idea_captured", {});
    // @ts-expect-error Product telemetry never accepts arbitrary creative properties.
    void trackProductEvent("intro_viewed", { lyrics: "private" });
  }

  expect(typeof trackProductEvent).toBe("function");
});

describe("production analytics privacy readiness", () => {
  beforeEach(() => {
    jest.mocked(secureStorage.getItem).mockReset().mockResolvedValue(null);
    jest.mocked(secureStorage.setItem).mockReset().mockResolvedValue(undefined);
    jest.mocked(randomUUID)
      .mockReset()
      .mockReturnValueOnce(UUIDS[0]!)
      .mockReturnValueOnce(UUIDS[1]!)
      .mockReturnValueOnce(UUIDS[2]!);
    delete process.env.EXPO_PUBLIC_PRIVACY_URL;
  });

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_PRIVACY_URL;
  });

  it("does not initialize collection for absent, malformed, or non-HTTPS notice configuration", async () => {
    for (const privacyUrl of [
      undefined,
      "not a URL",
      "http://himu.app/privacy",
      "javascript:alert(1)",
    ]) {
      if (privacyUrl === undefined) delete process.env.EXPO_PUBLIC_PRIVACY_URL;
      else process.env.EXPO_PUBLIC_PRIVACY_URL = privacyUrl;

      await expect(trackProductEvent("intro_viewed", {})).resolves.toBeUndefined();
    }

    expect(secureStorage.getItem).not.toHaveBeenCalled();
    expect(secureStorage.setItem).not.toHaveBeenCalled();
  });

  it("enables collection when a validated HTTPS privacy notice is configured", async () => {
    process.env.EXPO_PUBLIC_PRIVACY_URL = "https://himu.app/privacy";

    await expect(trackProductEvent("intro_viewed", {})).resolves.toBeUndefined();

    expect(secureStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(secureStorage.setItem).toHaveBeenCalled();
  });
});

test("keeps at most 50 events and drops the oldest event first", async () => {
  const firstDelivery = deferred<void>();
  const { client, values } = harness({
    transport: () => firstDelivery.promise,
  });

  const tracks = Array.from({ length: 51 }, (_, elapsedMs) =>
    client.trackProductEvent("intro_completed", { elapsedMs }));
  await settleUntil(() => {
    const serialized = values.get(STORAGE_KEY);
    if (!serialized) return false;
    const queue = JSON.parse(serialized).queue;
    return queue.length === 50 && queue[49]?.envelope?.properties?.elapsedMs === 50;
  });

  const persisted = JSON.parse(values.get(STORAGE_KEY) ?? "null") as {
    queue: { envelope: ProductEventEnvelope }[];
  };
  expect(persisted.queue).toHaveLength(50);
  expect(persisted.queue[0]?.envelope.properties).toEqual({ elapsedMs: 1 });
  expect(persisted.queue[49]?.envelope.properties).toEqual({ elapsedMs: 50 });

  firstDelivery.resolve();
  await Promise.all(tracks);
});

test("delivers oldest first, limits an event to three attempts, then continues", async () => {
  let call = 0;
  const delivered: string[] = [];
  const { client } = harness({
    transport: async (event) => {
      delivered.push(event.eventId);
      call += 1;
      if (call <= 3) throw new Error("raw transport details");
    },
  });

  await expect(client.trackProductEvent("intro_viewed", {})).resolves.toBeUndefined();
  await expect(client.trackProductEvent("auth_started", {})).resolves.toBeUndefined();
  await expect(client.trackProductEvent("auth_failed", {
    errorCategory: "network",
  })).resolves.toBeUndefined();

  expect(delivered).toEqual([UUIDS[2], UUIDS[2], UUIDS[2], UUIDS[3], UUIDS[4]]);
});

test("serializes concurrent drains without delivering an event twice", async () => {
  const firstDelivery = deferred<void>();
  const delivered: string[] = [];
  const { client } = harness({
    transport: async (event) => {
      delivered.push(event.eventId);
      if (delivered.length === 1) await firstDelivery.promise;
    },
  });

  const first = client.trackProductEvent("intro_viewed", {});
  const second = client.trackProductEvent("auth_started", {});
  await settleUntil(() => delivered.length === 1);
  expect(delivered).toEqual([UUIDS[2]]);

  firstDelivery.resolve();
  await Promise.all([first, second]);
  expect(delivered).toEqual([UUIDS[2], UUIDS[3]]);
});

test("a persistence failure is non-blocking and does not poison later drains", async () => {
  let writes = 0;
  const values = new Map<string, string>();
  const setItem = jest.fn(async (key: string, value: string) => {
    writes += 1;
    if (writes === 1) throw new Error("private storage details");
    values.set(key, value);
  });
  const { client, transport } = harness({ setItem });

  await expect(client.trackProductEvent("intro_viewed", {})).resolves.toBeUndefined();
  await expect(client.trackProductEvent("auth_started", {})).resolves.toBeUndefined();

  expect(transport.mock.calls.map(([event]) => event.eventId)).toEqual([
    UUIDS[2],
    UUIDS[3],
  ]);
});
