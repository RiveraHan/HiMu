import assert from "node:assert/strict";

import {
  authenticateProductEventRequest,
  handleProductEventEdgeRequest,
  handleProductEventRequest,
  parseProductEventEnvelope,
  type ProductEventEnvelope,
} from "../../supabase/functions/product-events/handler";

const EVENT_ID = "00000000-0000-4000-8000-000000000001";
const INSTALLATION_ID = "00000000-0000-4000-8000-000000000002";
const SESSION_ID = "00000000-0000-4000-8000-000000000003";
const USER_ID = "00000000-0000-4000-8000-000000000004";

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

function request(body: unknown, headers?: HeadersInit) {
  return new Request("https://edge.example/product-events", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function main() {
  const parsed = parseProductEventEnvelope(envelope());
  assert.equal(parsed.ok, true);

  const invalidEnvelopes = [
    envelope({ name: "unknown_event" }),
    envelope({ eventId: "not-a-uuid" }),
    envelope({ properties: { unknown: "value" } }),
    envelope({ properties: { lyrics: "private lyrics" } }),
    envelope({ properties: { step: "x".repeat(65) } }),
    envelope({ properties: { step: "identity" } }),
  ];
  for (const candidate of invalidEnvelopes) {
    assert.deepEqual(parseProductEventEnvelope(candidate), {
      ok: false,
      code: "invalid_input",
    });
  }
  assert.deepEqual(
    parseProductEventEnvelope(envelope({
      properties: { errorCategory: "x".repeat(4_100) },
    })),
    { ok: false, code: "payload_too_large" },
  );

  const acceptedCalls: Array<[ProductEventEnvelope, string | null]> = [];
  assert.deepEqual(
    await handleProductEventRequest(envelope(), USER_ID, {
      record: async (event, userId) => {
        acceptedCalls.push([event, userId]);
        return "accepted";
      },
    }),
    { status: 202, body: { status: "accepted" } },
  );
  assert.equal(acceptedCalls[0]?.[1], USER_ID);
  assert.deepEqual(
    await handleProductEventRequest(envelope(), null, {
      record: async () => "duplicate",
    }),
    { status: 202, body: { status: "duplicate" } },
  );
  assert.deepEqual(
    await handleProductEventRequest(envelope(), null, {
      record: async () => "rate_limited",
    }),
    { status: 429, body: { error: "rate_limited", code: "rate_limited" } },
  );

  let authCalls = 0;
  let anonymousUser: string | null | undefined = undefined;
  const anonymous = await handleProductEventEdgeRequest(request(envelope()), {
    authenticate: async () => {
      authCalls += 1;
      return { verified: true, userId: USER_ID };
    },
    record: async (_event, userId) => {
      anonymousUser = userId;
      return "accepted";
    },
  });
  assert.equal(anonymous.status, 202);
  assert.equal(authCalls, 0);
  assert.equal(anonymousUser, null);

  let anonymousBearerAuthCalls = 0;
  const anonymousBearer = await handleProductEventEdgeRequest(
    request(envelope(), { Authorization: "Bearer public-anon-key" }),
    {
      authenticate: (req) => authenticateProductEventRequest(req, async () => {
        anonymousBearerAuthCalls += 1;
        return null;
      }),
      record: async () => "accepted",
    },
  );
  assert.deepEqual(anonymousBearer, {
    status: 401,
    body: { error: "unauthorized", code: "unauthorized" },
  });
  assert.equal(anonymousBearerAuthCalls, 1);

  let invalidTokenWrites = 0;
  const invalidToken = await handleProductEventEdgeRequest(
    request(envelope(), { Authorization: "Bearer invalid-token" }),
    {
      authenticate: (req) => authenticateProductEventRequest(req, async () => null),
      record: async () => {
        invalidTokenWrites += 1;
        return "accepted";
      },
    },
  );
  assert.deepEqual(invalidToken, {
    status: 401,
    body: { error: "unauthorized", code: "unauthorized" },
  });
  assert.equal(invalidTokenWrites, 0);

  const verified = await handleProductEventEdgeRequest(
    request(envelope(), { Authorization: "Bearer verified-token" }),
    {
      authenticate: (req) => authenticateProductEventRequest(req, async () => ({
        id: USER_ID,
      })),
      record: async (_event, userId) => {
        assert.equal(userId, USER_ID);
        return "accepted";
      },
    },
  );
  assert.equal(verified.status, 202);

  const malformed = await handleProductEventEdgeRequest(
    new Request("https://edge.example/product-events", {
      method: "POST",
      body: "not-json",
    }),
    { authenticate: async () => ({ verified: false }), record: async () => "accepted" },
  );
  assert.equal(malformed.status, 400);

  const oversized = await handleProductEventEdgeRequest(
    request(envelope({ properties: { lyrics: "x".repeat(4_100) } })),
    { authenticate: async () => ({ verified: false }), record: async () => "accepted" },
  );
  assert.deepEqual(oversized, {
    status: 400,
    body: { error: "payload_too_large", code: "payload_too_large" },
  });

  const unavailable = await handleProductEventRequest(envelope(), null, {
    record: async () => { throw new Error("private database response"); },
  });
  assert.deepEqual(unavailable, {
    status: 503,
    body: { error: "collector_unavailable", code: "collector_unavailable" },
  });
  assert.doesNotMatch(JSON.stringify(unavailable), /private|database/i);

  console.log("product events function checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
