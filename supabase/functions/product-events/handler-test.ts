import {
  handleProductEventRequest,
  parseProductEventEnvelope,
} from "./handler.ts";

const EVENT_ID = "00000000-0000-4000-8000-000000000001";
const INSTALLATION_ID = "00000000-0000-4000-8000-000000000002";
const SESSION_ID = "00000000-0000-4000-8000-000000000003";

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    eventId: EVENT_ID,
    installationId: INSTALLATION_ID,
    sessionId: SESSION_ID,
    name: "intro_step_viewed",
    occurredAt: "2026-08-25T12:00:00.000Z",
    properties: { flowVersion: 2, platform: "web", locale: "es", step: "promise" },
    ...overrides,
  };
}

Deno.test("accepts the exact allowlisted envelope", () => {
  const result = parseProductEventEnvelope(envelope());
  if (!result.ok || result.value.name !== "intro_step_viewed") {
    throw new Error("expected the envelope to pass validation");
  }
});

Deno.test("rejects unknown or creative property keys", () => {
  for (const properties of [
    { unexpected: "value" },
    { lyrics: "private lyrics" },
    { url: "https://private.example" },
  ]) {
    const result = parseProductEventEnvelope(envelope({ properties }));
    if (result.ok || result.code !== "invalid_input") {
      throw new Error("expected invalid input");
    }
  }
});

Deno.test("returns accepted then duplicate without a second store insertion", async () => {
  const eventIds = new Set<string>();
  let insertions = 0;
  const record = async (event: { eventId: string }) => {
    if (eventIds.has(event.eventId)) return "duplicate" as const;
    eventIds.add(event.eventId);
    insertions += 1;
    return "accepted" as const;
  };

  const accepted = await handleProductEventRequest(envelope(), null, { record });
  const duplicate = await handleProductEventRequest(envelope(), null, { record });

  if (accepted.status !== 202 || duplicate.status !== 202 || insertions !== 1) {
    throw new Error("expected idempotent accepted and duplicate outcomes");
  }
});

Deno.test("maps a rate-limited RPC outcome to 429", async () => {
  const limited = await handleProductEventRequest(envelope(), null, {
    record: async () => "rate_limited",
  });

  if (limited.status !== 429) {
    throw new Error("expected a bounded rate-limit outcome");
  }
});
