const mockValues = new Map<string, string>();

jest.mock("@/src/lib/secure-storage", () => ({
  secureStorage: {
    getItem: jest.fn(async (key: string) => mockValues.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockValues.set(key, value);
    }),
  },
}));

// The storage dependency must be mocked before importing the module under test.
// eslint-disable-next-line import/first
import {
  applyBetaSmokeExperienceAction,
  markBetaSmokeTrackReady,
  readBetaSmokeMusicPreferences,
  readBetaSmokeExperienceState,
  writeBetaSmokeMusicPreferences,
} from "@/src/beta-smoke-storage";
// eslint-disable-next-line import/first
import { BETA_SMOKE_TRACK_ID, BETA_SMOKE_USER_ID } from "@/src/beta-smoke";

beforeEach(() => mockValues.clear());

test("persists a ready smoke track and terminal preference completion across a fresh read", async () => {
  await markBetaSmokeTrackReady(BETA_SMOKE_USER_ID);
  const shown = await applyBetaSmokeExperienceAction(BETA_SMOKE_USER_ID, {
    action: "claim_nudge",
    trackId: BETA_SMOKE_TRACK_ID,
  });
  await applyBetaSmokeExperienceAction(BETA_SMOKE_USER_ID, { action: "complete_nudge" });

  expect(shown.preferenceNudgeStatus).toBe("shown");
  await expect(readBetaSmokeExperienceState(BETA_SMOKE_USER_ID)).resolves.toMatchObject({
    firstOwnedTrackId: BETA_SMOKE_TRACK_ID,
    preferenceNudgeStatus: "completed",
  });
});

test("keeps smoke preference saves local and readable after a remount", async () => {
  await writeBetaSmokeMusicPreferences(BETA_SMOKE_USER_ID, {
    genres: ["Ambient"],
    excludedMoods: ["Focus"],
    atmosphere: "intense",
  });

  await expect(readBetaSmokeMusicPreferences(BETA_SMOKE_USER_ID)).resolves.toEqual({
    genres: ["Ambient"],
    excludedMoods: ["Focus"],
    atmosphere: "intense",
  });
});
