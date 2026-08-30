import {
  BETA_SMOKE_DJ_ID,
  BETA_SMOKE_TRACK,
  BETA_SMOKE_TRACK_ID,
  betaSmokeExperienceState,
  isBetaSmokeTrackForEnvironment,
  isBetaSmokeUserForEnvironment,
  transitionBetaSmokeExperience,
} from "@/src/beta-smoke";

describe("beta smoke boundary", () => {
  it("only enables the synthetic user under both development guards", () => {
    expect(isBetaSmokeUserForEnvironment("beta-smoke-local-user", true, "1")).toBe(true);
    expect(isBetaSmokeUserForEnvironment("another-user", true, "1")).toBe(false);
    expect(isBetaSmokeUserForEnvironment("beta-smoke-local-user", false, "1")).toBe(false);
    expect(isBetaSmokeUserForEnvironment("beta-smoke-local-user", true, undefined)).toBe(false);
  });

  it("only substitutes the exact synthetic Player track", () => {
    expect(isBetaSmokeTrackForEnvironment(
      "beta-smoke-local-user",
      BETA_SMOKE_TRACK_ID,
      true,
      "1",
    )).toBe(true);
    expect(isBetaSmokeTrackForEnvironment(
      "beta-smoke-local-user",
      "a-real-track",
      true,
      "1",
    )).toBe(false);
    expect(isBetaSmokeTrackForEnvironment(
      "near-miss-user",
      BETA_SMOKE_TRACK_ID,
      true,
      "1",
    )).toBe(false);
    expect(isBetaSmokeTrackForEnvironment(
      "beta-smoke-local-user",
      BETA_SMOKE_TRACK_ID,
      false,
      "1",
    )).toBe(false);
    expect(isBetaSmokeTrackForEnvironment(
      "beta-smoke-local-user",
      BETA_SMOKE_TRACK_ID,
      true,
      "0",
    )).toBe(false);
  });

  it("uses stable DJ and ready-track identifiers for the executable smoke path", () => {
    expect(BETA_SMOKE_DJ_ID).toBe("beta-smoke-dj");
    expect(BETA_SMOKE_TRACK.id).toBe(BETA_SMOKE_TRACK_ID);
    expect(BETA_SMOKE_TRACK.owner_id).toBe("beta-smoke-local-user");
  });

  it("makes the ready track claimable once and keeps a completed nudge terminal", () => {
    const eligible = betaSmokeExperienceState("eligible");
    const shown = transitionBetaSmokeExperience(eligible, {
      action: "claim_nudge",
      trackId: BETA_SMOKE_TRACK_ID,
    });
    const completed = transitionBetaSmokeExperience(shown, { action: "complete_nudge" });

    expect(eligible.preferenceNudgeTrackId).toBe(BETA_SMOKE_TRACK_ID);
    expect(shown.preferenceNudgeStatus).toBe("shown");
    expect(transitionBetaSmokeExperience(completed, {
      action: "claim_nudge",
      trackId: BETA_SMOKE_TRACK_ID,
    })).toEqual(completed);
  });
});
