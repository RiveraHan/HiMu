import { supabase } from "@/src/api/supabase";
import { secureStorage } from "@/src/lib/secure-storage";
import { randomUUID } from "expo-crypto";

import {
  parseProductEventEnvelope,
  type ProductEventEnvelope,
  type ProductEventName,
  type ProductEventProperties,
} from "../../supabase/functions/product-events/handler";

export type { ProductEventName, ProductEventProperties };

export type ProductAnalyticsStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type ProductAnalyticsDependencies = {
  storage: ProductAnalyticsStorage;
  randomUUID(): string;
  now(): Date;
  transport(event: ProductEventEnvelope): Promise<void>;
};

type QueuedProductEvent = {
  envelope: ProductEventEnvelope;
  attempts: number;
};

type ProductAnalyticsState = {
  version: 1;
  installationId: string;
  sessionId: string;
  queue: QueuedProductEvent[];
};

export type ProductAnalyticsClient = {
  trackProductEvent(
    name: ProductEventName,
    properties: ProductEventProperties,
  ): Promise<void>;
};

const STORAGE_KEY = "himu.product-analytics.v1";
const MAX_QUEUE_SIZE = 50;
const MAX_DELIVERY_ATTEMPTS = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function freshState(deps: ProductAnalyticsDependencies): ProductAnalyticsState {
  return {
    version: 1,
    installationId: deps.randomUUID(),
    sessionId: deps.randomUUID(),
    queue: [],
  };
}

function parseState(
  serialized: string | null,
  deps: ProductAnalyticsDependencies,
): ProductAnalyticsState {
  if (!serialized) return freshState(deps);

  try {
    const raw = object(JSON.parse(serialized));
    if (
      !raw ||
      raw.version !== 1 ||
      typeof raw.installationId !== "string" ||
      !UUID.test(raw.installationId) ||
      typeof raw.sessionId !== "string" ||
      !UUID.test(raw.sessionId) ||
      !Array.isArray(raw.queue)
    ) {
      return freshState(deps);
    }

    const queue: QueuedProductEvent[] = [];
    for (const candidate of raw.queue) {
      const value = object(candidate);
      if (
        !value ||
        !Number.isInteger(value.attempts) ||
        (value.attempts as number) < 0 ||
        (value.attempts as number) >= MAX_DELIVERY_ATTEMPTS
      ) continue;
      const parsed = parseProductEventEnvelope(value.envelope);
      if (!parsed.ok || parsed.value.installationId !== raw.installationId) continue;
      queue.push({ envelope: parsed.value, attempts: value.attempts as number });
    }

    return {
      version: 1,
      installationId: raw.installationId,
      sessionId: raw.sessionId,
      queue: queue.slice(-MAX_QUEUE_SIZE),
    };
  } catch {
    return freshState(deps);
  }
}

export function createProductAnalyticsClient(
  deps: ProductAnalyticsDependencies,
): ProductAnalyticsClient {
  let statePromise: Promise<ProductAnalyticsState> | null = null;
  let stateTail: Promise<void> = Promise.resolve();
  let drainPromise: Promise<"empty" | "blocked"> | null = null;

  function state(): Promise<ProductAnalyticsState> {
    if (!statePromise) {
      statePromise = deps.storage.getItem(STORAGE_KEY)
        .then((value) => parseState(value, deps))
        .catch(() => freshState(deps));
    }
    return statePromise;
  }

  function withState<T>(
    operation: (current: ProductAnalyticsState) => Promise<T> | T,
  ): Promise<T> {
    const result = stateTail.then(async () => operation(await state()));
    stateTail = result.then(() => undefined, () => undefined);
    return result;
  }

  async function persist(current: ProductAnalyticsState): Promise<void> {
    try {
      await deps.storage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Product telemetry is never allowed to fail a product interaction.
    }
  }

  async function runDrain(): Promise<"empty" | "blocked"> {
    while (true) {
      const queued = await withState((current) => current.queue[0] ?? null);
      if (!queued) return "empty";

      try {
        await deps.transport(queued.envelope);
      } catch {
        return withState(async (current) => {
          const index = current.queue.findIndex(
            ({ envelope }) => envelope.eventId === queued.envelope.eventId,
          );
          if (index < 0) return "empty";

          const failed = current.queue[index]!;
          failed.attempts += 1;
          const exhausted = failed.attempts >= MAX_DELIVERY_ATTEMPTS;
          if (exhausted) current.queue.splice(index, 1);
          await persist(current);
          return exhausted ? "empty" : "blocked";
        });
      }

      await withState(async (current) => {
        const index = current.queue.findIndex(
          ({ envelope }) => envelope.eventId === queued.envelope.eventId,
        );
        if (index >= 0) current.queue.splice(index, 1);
        await persist(current);
      });
    }
  }

  async function drain(): Promise<void> {
    while (true) {
      const active = drainPromise ?? runDrain();
      drainPromise = active;
      const result = await active;
      if (drainPromise === active) drainPromise = null;
      if (result === "blocked") return;

      const hasQueuedEvent = await withState((current) => current.queue.length > 0);
      if (!hasQueuedEvent) return;
    }
  }

  async function enqueue(
    name: ProductEventName,
    properties: ProductEventProperties,
  ): Promise<void> {
    const current = await state();
    const parsed = parseProductEventEnvelope({
      eventId: deps.randomUUID(),
      installationId: current.installationId,
      sessionId: current.sessionId,
      name,
      occurredAt: deps.now().toISOString(),
      properties,
    });
    if (!parsed.ok) return;

    await withState(async (latest) => {
      latest.queue.push({ envelope: parsed.value, attempts: 0 });
      if (latest.queue.length > MAX_QUEUE_SIZE) {
        latest.queue.splice(0, latest.queue.length - MAX_QUEUE_SIZE);
      }
      await persist(latest);
    });
    await drain();
  }

  return {
    trackProductEvent(name, properties) {
      const propertySnapshot = object(properties);
      if (!propertySnapshot) return Promise.resolve();
      return enqueue(name, { ...propertySnapshot } as ProductEventProperties)
        .catch(() => undefined);
    },
  };
}

const productAnalytics = createProductAnalyticsClient({
  storage: secureStorage,
  randomUUID,
  now: () => new Date(),
  transport: async (event) => {
    const { error } = await supabase.functions.invoke("product-events", {
      body: event,
    });
    if (error) throw new Error("product_event_delivery_failed");
  },
});

export function trackProductEvent(
  name: ProductEventName,
  properties: ProductEventProperties,
): Promise<void> {
  return productAnalytics.trackProductEvent(name, properties);
}
