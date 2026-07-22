import { createContext, use } from "react";

import type { OnboardingPhase } from "./onboarding-machine";
import type { ContextualTipId, SpotlightStepDefinition, TourTargetId } from "./types";

export type HomeTourRegistration = {
  ready: boolean;
  hasPlayableCandidate: boolean;
  steps: readonly SpotlightStepDefinition[];
  ensureStepVisible: (stepId: string) => Promise<void>;
  playFirstAvailable: () => Promise<boolean>;
};

export type AppTourContextValue = {
  phase: OnboardingPhase;
  registerHome(input: HomeTourRegistration): () => void;
  registerContextTarget(input: {
    tipId: ContextualTipId;
    targetId: TourTargetId;
    ready: boolean;
  }): () => void;
  continueTour(): void;
  replayTour(): void;
  dismissActiveTour(): void;
  finishWithPlayback(): Promise<void>;
  canContinue: boolean;
};

export const AppTourContext = createContext<AppTourContextValue | null>(null);

export function useAppTour(): AppTourContextValue {
  const value = use(AppTourContext);
  if (!value) throw new Error("useAppTour must be used within AppTourProvider");
  return value;
}
