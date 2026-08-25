export type ExperienceAction =
  | { action: "sync_intro"; version: number }
  | { action: "claim_nudge"; trackId: string }
  | { action: "dismiss_nudge"; trackId: string }
  | { action: "complete_nudge" };

export type ExperienceStateDependencies = {
  transition(
    userId: string,
    action: ExperienceAction["action"],
    introVersion: number | null,
    trackId: string | null,
  ): Promise<unknown>;
};

export class ExperienceStateConflictError extends Error {}

type ExperienceStateResult = { status: number; body: Record<string, unknown> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function error(status: number, code: string): ExperienceStateResult {
  return { status, body: { error: code, code } };
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function parseAction(raw: unknown): ExperienceAction | null {
  const value = object(raw);
  if (!value || typeof value.action !== "string") return null;

  if (
    value.action === "sync_intro" &&
    exactKeys(value, ["action", "version"]) &&
    Number.isInteger(value.version) &&
    (value.version as number) > 0 &&
    (value.version as number) <= 2_147_483_647
  ) {
    return { action: value.action, version: value.version as number };
  }

  if (
    (value.action === "claim_nudge" || value.action === "dismiss_nudge") &&
    exactKeys(value, ["action", "trackId"]) &&
    typeof value.trackId === "string" &&
    UUID.test(value.trackId)
  ) {
    return { action: value.action, trackId: value.trackId };
  }

  return value.action === "complete_nudge" && exactKeys(value, ["action"])
    ? { action: "complete_nudge" }
    : null;
}

export async function handleExperienceStateRequest(
  raw: unknown,
  userId: string,
  deps: ExperienceStateDependencies,
): Promise<ExperienceStateResult> {
  const action = parseAction(raw);
  if (!action) return error(400, "invalid_input");

  const introVersion = action.action === "sync_intro" ? action.version : null;
  const trackId = action.action === "claim_nudge" || action.action === "dismiss_nudge"
    ? action.trackId
    : null;

  try {
    const state = await deps.transition(userId, action.action, introVersion, trackId);
    const body = object(state);
    return body ? { status: 200, body } : error(503, "state_unavailable");
  } catch (caught) {
    return caught instanceof ExperienceStateConflictError
      ? error(409, "state_conflict")
      : error(503, "state_unavailable");
  }
}
