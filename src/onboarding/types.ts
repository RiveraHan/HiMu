export type TourTargetId =
  | "home.hero"
  | "home.djs"
  | "tabs.discover"
  | "discover.search"
  | "dj.hero";

export type ContextualTipId = "discover.search" | "dj.hero";

export type OnboardingStatus = "in_progress" | "completed" | "skipped";

export type OnboardingRecord = {
  userId: string;
  version: number;
  status: OnboardingStatus;
  lastStep: string | null;
  startedAt: string;
  completedAt: string | null;
  skippedAt: string | null;
  firstPlayAt: string | null;
  contextualTips: Partial<Record<ContextualTipId, string>>;
  replayCount: number;
  lastReplayedAt: string | null;
  updatedAt: string;
};

export type SpotlightStep = {
  id: string;
  targetId: TourTargetId;
  title: string;
  description: string;
  placement: "top" | "bottom";
};
