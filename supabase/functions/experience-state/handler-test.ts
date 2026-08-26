import {
  handleExperienceStateRequest,
} from "./handler.ts";

const USER_ID = "00000000-0000-4000-8000-000000000101";
const TRACK_ID = "00000000-0000-4000-8000-000000000201";

Deno.test("uses the verified user and valid action payload", async () => {
  const state = {
    introVersionSeen: 2,
    firstOwnedTrackId: TRACK_ID,
    firstOwnedTrackReadyAt: "2026-08-25T12:00:00.000Z",
    preferenceNudgeStatus: "eligible",
    preferenceNudgeTrackId: TRACK_ID,
  };
  const calls: unknown[][] = [];

  const result = await handleExperienceStateRequest(
    { action: "claim_nudge", trackId: TRACK_ID },
    USER_ID,
    {
      transition: async (...args: unknown[]) => {
        calls.push(args);
        return state;
      },
    },
  );

  if (result.status !== 200) throw new Error("expected success");
  if (calls.length !== 1) throw new Error("expected one RPC transition");
  if (calls[0]?.[0] !== USER_ID) throw new Error("expected verified user ID");
  if (calls[0]?.[1] !== "claim_nudge") throw new Error("expected claim action");
});

Deno.test("rejects sync versions outside PostgreSQL integer range", async () => {
  const result = await handleExperienceStateRequest(
    { action: "sync_intro", version: 2_147_483_648 },
    USER_ID,
    { transition: async () => ({}) },
  );

  if (result.status !== 400 || result.body.code !== "invalid_input") {
    throw new Error("expected invalid input for an out-of-range version");
  }
});
