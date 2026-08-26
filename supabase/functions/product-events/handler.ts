export type ProductEventName =
  | "intro_viewed"
  | "intro_step_viewed"
  | "intro_completed"
  | "auth_started"
  | "auth_succeeded"
  | "auth_failed"
  | "first_track_gate_resolved"
  | "first_track_intent_cancelled"
  | "dj_creation_started"
  | "dj_step_completed"
  | "dj_identity_draft_succeeded"
  | "dj_identity_draft_failed"
  | "dj_created"
  | "dj_creation_failed"
  | "track_generation_confirmed"
  | "track_generation_ready"
  | "track_generation_failed"
  | "preference_nudge_shown"
  | "preference_nudge_accepted"
  | "preference_nudge_dismissed"
  | "music_preferences_saved";

export type ProductEventProperties = Readonly<{
  flowVersion?: number;
  platform?: "android" | "ios" | "web";
  locale?: "en" | "es";
  step?: "promise" | "dj" | "result" | "sound" | "identity" | "review";
  elapsedMs?: number;
  selectedCountBucket?: "0" | "1" | "2-3" | "4-5" | "6+";
  routeOutcome?: "create_dj" | "create_track" | "multiple_djs_create_track" | "home";
  errorCategory?:
    | "cancelled"
    | "network"
    | "offline"
    | "provider"
    | "quota"
    | "rate_limited"
    | "validation"
    | "unknown";
}>;

export type ProductEventEnvelope = Readonly<{
  eventId: string;
  installationId: string;
  sessionId: string;
  name: ProductEventName;
  occurredAt: string;
  properties: ProductEventProperties;
}>;

export type ProductEventRecordResult = "accepted" | "duplicate" | "rate_limited";

export type ProductEventDependencies = {
  record(
    event: ProductEventEnvelope,
    userId: string | null,
  ): Promise<ProductEventRecordResult>;
};

export type ProductEventEdgeDependencies = ProductEventDependencies & {
  authenticate(req: Request): Promise<
    | { verified: true; userId: string | null }
    | { verified: false }
  >;
};

type ProductEventHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MAX_PAYLOAD_BYTES = 4_096;

const EVENT_NAMES = new Set<ProductEventName>([
  "intro_viewed",
  "intro_step_viewed",
  "intro_completed",
  "auth_started",
  "auth_succeeded",
  "auth_failed",
  "first_track_gate_resolved",
  "first_track_intent_cancelled",
  "dj_creation_started",
  "dj_step_completed",
  "dj_identity_draft_succeeded",
  "dj_identity_draft_failed",
  "dj_created",
  "dj_creation_failed",
  "track_generation_confirmed",
  "track_generation_ready",
  "track_generation_failed",
  "preference_nudge_shown",
  "preference_nudge_accepted",
  "preference_nudge_dismissed",
  "music_preferences_saved",
]);

type PropertyName = keyof ProductEventProperties;

const COMMON_PROPERTIES = ["flowVersion", "platform", "locale"] as const;
const EVENT_PROPERTIES: Record<ProductEventName, ReadonlySet<PropertyName>> = {
  intro_viewed: new Set(COMMON_PROPERTIES),
  intro_step_viewed: new Set([...COMMON_PROPERTIES, "step"]),
  intro_completed: new Set([...COMMON_PROPERTIES, "elapsedMs"]),
  auth_started: new Set(COMMON_PROPERTIES),
  auth_succeeded: new Set(COMMON_PROPERTIES),
  auth_failed: new Set([...COMMON_PROPERTIES, "errorCategory"]),
  first_track_gate_resolved: new Set([...COMMON_PROPERTIES, "routeOutcome"]),
  first_track_intent_cancelled: new Set([...COMMON_PROPERTIES, "routeOutcome"]),
  dj_creation_started: new Set(COMMON_PROPERTIES),
  dj_step_completed: new Set([...COMMON_PROPERTIES, "step", "elapsedMs"]),
  dj_identity_draft_succeeded: new Set([...COMMON_PROPERTIES, "elapsedMs"]),
  dj_identity_draft_failed: new Set([...COMMON_PROPERTIES, "errorCategory"]),
  dj_created: new Set([...COMMON_PROPERTIES, "elapsedMs"]),
  dj_creation_failed: new Set([...COMMON_PROPERTIES, "errorCategory"]),
  track_generation_confirmed: new Set([...COMMON_PROPERTIES, "selectedCountBucket"]),
  track_generation_ready: new Set([...COMMON_PROPERTIES, "elapsedMs"]),
  track_generation_failed: new Set([...COMMON_PROPERTIES, "errorCategory"]),
  preference_nudge_shown: new Set(COMMON_PROPERTIES),
  preference_nudge_accepted: new Set(COMMON_PROPERTIES),
  preference_nudge_dismissed: new Set(COMMON_PROPERTIES),
  music_preferences_saved: new Set([...COMMON_PROPERTIES, "selectedCountBucket"]),
};

function error(status: number, code: string): ProductEventHttpResult {
  return { status, body: { error: code, code } };
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function serializedSize(value: unknown): number | null {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? null : utf8ByteLength(serialized);
  } catch {
    return null;
  }
}

function allowedString(value: unknown, choices: readonly string[]): boolean {
  return typeof value === "string" && value.length <= 64 && choices.includes(value);
}

function validProperty(name: PropertyName, value: unknown): boolean {
  switch (name) {
    case "flowVersion":
      return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 100;
    case "platform":
      return allowedString(value, ["android", "ios", "web"]);
    case "locale":
      return allowedString(value, ["en", "es"]);
    case "step":
      return allowedString(value, ["promise", "dj", "result", "sound", "identity", "review"]);
    case "elapsedMs":
      return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 86_400_000;
    case "selectedCountBucket":
      return allowedString(value, ["0", "1", "2-3", "4-5", "6+"]);
    case "routeOutcome":
      return allowedString(value, ["create_dj", "create_track", "multiple_djs_create_track", "home"]);
    case "errorCategory":
      return allowedString(value, [
        "cancelled",
        "network",
        "offline",
        "provider",
        "quota",
        "rate_limited",
        "validation",
        "unknown",
      ]);
  }
}

function validEventProperties(
  eventName: ProductEventName,
  raw: unknown,
): ProductEventProperties | null {
  const properties = object(raw);
  if (!properties) return null;
  const allowed = EVENT_PROPERTIES[eventName];

  for (const [key, value] of Object.entries(properties)) {
    if (!allowed.has(key as PropertyName)) return null;
    if (!validProperty(key as PropertyName, value)) return null;
    if (key === "step") {
      const allowedSteps = eventName === "intro_step_viewed"
        ? ["promise", "dj", "result"]
        : eventName === "dj_step_completed"
        ? ["sound", "identity", "review"]
        : [];
      if (!allowedSteps.includes(value as string)) return null;
    }
    if (key === "routeOutcome") {
      const allowedOutcomes = eventName === "first_track_gate_resolved"
        ? ["create_dj", "create_track", "multiple_djs_create_track"]
        : eventName === "first_track_intent_cancelled"
        ? ["home"]
        : [];
      if (!allowedOutcomes.includes(value as string)) return null;
    }
  }

  return { ...properties } as ProductEventProperties;
}

export function parseProductEventEnvelope(raw: unknown):
  | { ok: true; value: ProductEventEnvelope }
  | { ok: false; code: "invalid_input" | "payload_too_large" } {
  const size = serializedSize(raw);
  if (size !== null && size > MAX_PAYLOAD_BYTES) {
    return { ok: false, code: "payload_too_large" };
  }

  const value = object(raw);
  if (
    size === null ||
    !value ||
    !exactKeys(value, [
      "eventId",
      "installationId",
      "sessionId",
      "name",
      "occurredAt",
      "properties",
    ]) ||
    typeof value.eventId !== "string" ||
    !UUID.test(value.eventId) ||
    typeof value.installationId !== "string" ||
    !UUID.test(value.installationId) ||
    typeof value.sessionId !== "string" ||
    !UUID.test(value.sessionId) ||
    typeof value.name !== "string" ||
    value.name.length > 64 ||
    !EVENT_NAMES.has(value.name as ProductEventName) ||
    typeof value.occurredAt !== "string" ||
    value.occurredAt.length > 64 ||
    !ISO_INSTANT.test(value.occurredAt) ||
    !Number.isFinite(Date.parse(value.occurredAt))
  ) {
    return { ok: false, code: "invalid_input" };
  }

  const name = value.name as ProductEventName;
  const properties = validEventProperties(name, value.properties);
  if (!properties) return { ok: false, code: "invalid_input" };

  return {
    ok: true,
    value: {
      eventId: value.eventId,
      installationId: value.installationId,
      sessionId: value.sessionId,
      name,
      occurredAt: value.occurredAt,
      properties,
    },
  };
}

export async function handleProductEventRequest(
  raw: unknown,
  userId: string | null,
  deps: ProductEventDependencies,
): Promise<ProductEventHttpResult> {
  const parsed = parseProductEventEnvelope(raw);
  if (!parsed.ok) return error(400, parsed.code);

  try {
    const result = await deps.record(parsed.value, userId);
    return result === "rate_limited"
      ? error(429, "rate_limited")
      : { status: 202, body: { status: result } };
  } catch {
    return error(503, "collector_unavailable");
  }
}

export async function handleProductEventEdgeRequest(
  req: Request,
  deps: ProductEventEdgeDependencies,
): Promise<ProductEventHttpResult> {
  if (req.method === "OPTIONS") return { status: 204, body: {} };
  if (req.method !== "POST") return error(405, "method_not_allowed");

  const hasAuthorization = req.headers.has("Authorization");
  let userId: string | null = null;
  if (hasAuthorization) {
    let authentication:
      | { verified: true; userId: string | null }
      | { verified: false };
    try {
      authentication = await deps.authenticate(req);
    } catch {
      return error(401, "unauthorized");
    }
    if (!authentication.verified) return error(401, "unauthorized");
    userId = authentication.userId;
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return error(400, "invalid_input");
  }
  if (utf8ByteLength(text) > MAX_PAYLOAD_BYTES) {
    return error(400, "payload_too_large");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return error(400, "invalid_input");
  }

  return handleProductEventRequest(raw, userId, deps);
}
