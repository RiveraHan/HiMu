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

Deno.test("accepts only the exact bounded properties for each Moment event", () => {
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

  for (const [name, properties] of cases) {
    const parsed = parseProductEventEnvelope(envelope({ name, properties }));
    if (!parsed.ok || parsed.value.name !== name) {
      throw new Error(`expected ${name} to pass validation`);
    }
  }
});

Deno.test("rejects missing, malformed, cross-event, or sensitive Moment properties", () => {
  const trackId = "00000000-0000-4000-8000-000000000021";
  for (const [name, properties] of [
    ["moment_shown", { visibility: "private" }],
    ["moment_shown", { trackId: "not-a-uuid", visibility: "private" }],
    ["moment_feedback_answered", { trackId, question: "surprised" }],
    ["moment_feedback_answered", { trackId, question: "surprised", answer: "yes" }],
    ["moment_visibility_completed", { trackId, visibility: "public", answer: true }],
    ["moment_share_outcome", { trackId, shareMethod: "clipboard", outcome: "copied", url: "https://private.example" }],
    ["moment_share_selected", { trackId, shareMethod: "native_share", recipient: "contact" }],
    ["moment_visibility_failed", { trackId, visibility: "public", rawError: "provider body" }],
  ] as const) {
    const parsed = parseProductEventEnvelope(envelope({ name, properties }));
    if (parsed.ok || parsed.code !== "invalid_input") {
      throw new Error(`expected ${name} to reject invalid properties`);
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
