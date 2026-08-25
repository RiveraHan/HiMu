import {
  handleExperienceStateRequest,
  type ExperienceState,
} from "./handler.ts";

const USER_ID = "00000000-0000-4000-8000-000000000101";
const TRACK_ID = "00000000-0000-4000-8000-000000000201";

Deno.test("uses the verified user and valid action payload", async () => {
  const state: ExperienceState = {
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
