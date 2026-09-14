export type ExperienceAction =
  | { action: "sync_intro"; version: number }
  | { action: "claim_nudge"; trackId: string }
  | { action: "dismiss_nudge"; trackId: string }
  | { action: "complete_nudge" };

export const experienceActions = {
  syncIntro(version: number): ExperienceAction {
    return { action: "sync_intro", version };
  },
  claimNudge(trackId: string): ExperienceAction {
    return { action: "claim_nudge", trackId };
  },
  dismissNudge(trackId: string): ExperienceAction {
    return { action: "dismiss_nudge", trackId };
  },
  completeNudge(): ExperienceAction {
    return { action: "complete_nudge" };
  },
};
