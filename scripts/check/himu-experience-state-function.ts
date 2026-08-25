import assert from "node:assert/strict";

import {
  handleExperienceStateRequest,
  type ExperienceState,
} from "../../supabase/functions/experience-state/handler";

const USER_ID = "00000000-0000-4000-8000-000000000101";
const TRACK_ID = "00000000-0000-4000-8000-000000000201";

async function main() {
  const expectedState: ExperienceState = {
    introVersionSeen: 2,
    firstOwnedTrackId: TRACK_ID,
    firstOwnedTrackReadyAt: "2026-08-25T12:00:00.000Z",
    preferenceNudgeStatus: "eligible",
    preferenceNudgeTrackId: TRACK_ID,
  };
  const transitionCalls: unknown[][] = [];
  const deps = {
    transition: async (...args: unknown[]) => {
      transitionCalls.push(args);
      return expectedState;
    },
  };

  assert.deepEqual(
    await handleExperienceStateRequest(
      { action: "claim_nudge", trackId: TRACK_ID },
      USER_ID,
      deps,
    ),
    { status: 200, body: expectedState },
  );
  assert.deepEqual(transitionCalls[0], [USER_ID, "claim_nudge", null, TRACK_ID]);
  assert.deepEqual(
    await handleExperienceStateRequest(
      { action: "sync_intro", version: 0 },
      USER_ID,
      deps,
    ),
    { status: 400, body: { error: "invalid_input", code: "invalid_input" } },
  );
  assert.deepEqual(
    await handleExperienceStateRequest(
      { action: "claim_nudge", trackId: "not-a-uuid" },
      USER_ID,
      deps,
    ),
    { status: 400, body: { error: "invalid_input", code: "invalid_input" } },
  );
  assert.deepEqual(
    await handleExperienceStateRequest(
      { action: "dismiss_nudge", trackId: TRACK_ID },
      USER_ID,
      deps,
    ),
    { status: 200, body: expectedState },
  );
  assert.deepEqual(transitionCalls[1], [USER_ID, "dismiss_nudge", null, TRACK_ID]);
  assert.deepEqual(
    await handleExperienceStateRequest(
      { action: "complete_nudge" },
      USER_ID,
      deps,
    ),
    { status: 200, body: expectedState },
  );
  assert.deepEqual(transitionCalls[2], [USER_ID, "complete_nudge", null, null]);
  assert.deepEqual(
    await handleExperienceStateRequest(
      { action: "sync_intro", version: 2 },
      USER_ID,
      deps,
    ),
    { status: 200, body: expectedState },
  );
  assert.deepEqual(transitionCalls[3], [USER_ID, "sync_intro", 2, null]);

  const unavailable = await handleExperienceStateRequest(
    { action: "complete_nudge" },
    USER_ID,
    { transition: async () => { throw new Error("secret database details"); } },
  );
  assert.deepEqual(unavailable, {
    status: 503,
    body: { error: "state_unavailable", code: "state_unavailable" },
  });
  assert.doesNotMatch(JSON.stringify(unavailable), /secret/i);

  console.log("experience state function checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
