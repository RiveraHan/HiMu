import assert from "node:assert/strict";

import {
  handleExperienceStateRequest,
} from "../../supabase/functions/experience-state/handler";
import { handleExperienceStateHttpRequest } from "../../supabase/functions/experience-state/adapter";

const USER_ID = "00000000-0000-4000-8000-000000000101";
const TRACK_ID = "00000000-0000-4000-8000-000000000201";

async function main() {
  const expectedState = {
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
      { action: "sync_intro", version: 2_147_483_648 },
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

  const databaseState = {
    intro_version_seen: 2,
    first_owned_track_id: TRACK_ID,
    first_owned_track_ready_at: "2026-08-25T12:00:00.000Z",
    preference_nudge_status: "eligible",
    preference_nudge_track_id: TRACK_ID,
  };
  const rpcCalls: unknown[][] = [];
  const adapterDeps = {
    rpc: async (...args: unknown[]) => {
      rpcCalls.push(args);
      return { data: [databaseState], error: null };
    },
  };
  assert.deepEqual(
    await handleExperienceStateHttpRequest(
      new Request("https://edge.example/experience-state", {
        method: "POST",
        body: JSON.stringify({ action: "claim_nudge", trackId: TRACK_ID }),
      }),
      USER_ID,
      adapterDeps,
    ),
    { status: 200, body: { state: databaseState } },
  );
  assert.deepEqual(rpcCalls, [["transition_user_experience", {
    p_user_id: USER_ID,
    p_action: "claim_nudge",
    p_intro_version: null,
    p_track_id: TRACK_ID,
  }]]);
  assert.deepEqual(
    await handleExperienceStateHttpRequest(
      new Request("https://edge.example/experience-state", { method: "GET" }),
      USER_ID,
      adapterDeps,
    ),
    { status: 400, body: { error: "invalid_input", code: "invalid_input" } },
  );
  assert.deepEqual(
    await handleExperienceStateHttpRequest(
      new Request("https://edge.example/experience-state", {
        method: "POST",
        body: "not-json",
      }),
      USER_ID,
      adapterDeps,
    ),
    { status: 400, body: { error: "invalid_input", code: "invalid_input" } },
  );
  assert.deepEqual(
    await handleExperienceStateHttpRequest(
      new Request("https://edge.example/experience-state", {
        method: "POST",
        body: JSON.stringify({
          action: "complete_nudge",
          userId: "another-user",
        }),
      }),
      USER_ID,
      adapterDeps,
    ),
    { status: 400, body: { error: "invalid_input", code: "invalid_input" } },
  );
  const conflict = await handleExperienceStateHttpRequest(
    new Request("https://edge.example/experience-state", {
      method: "POST",
      body: JSON.stringify({ action: "complete_nudge" }),
    }),
    USER_ID,
    { rpc: async () => ({ data: null, error: { code: "P0001", message: "private conflict details" } }) },
  );
  assert.deepEqual(conflict, {
    status: 409,
    body: { error: "state_conflict", code: "state_conflict" },
  });
  const databaseFailure = await handleExperienceStateHttpRequest(
    new Request("https://edge.example/experience-state", {
      method: "POST",
      body: JSON.stringify({ action: "complete_nudge" }),
    }),
    USER_ID,
    { rpc: async () => ({ data: null, error: { code: "XX000", message: "private database details" } }) },
  );
  assert.deepEqual(databaseFailure, {
    status: 503,
    body: { error: "state_unavailable", code: "state_unavailable" },
  });
  assert.doesNotMatch(JSON.stringify(databaseFailure), /private/i);

  console.log("experience state function checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
