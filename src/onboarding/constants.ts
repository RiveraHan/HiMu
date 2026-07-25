import type { ContextualTipId, SpotlightStepDefinition } from "./types";

export const ONBOARDING_VERSION = 1;
export const ONBOARDING_STORAGE_PREFIX = "himu:onboarding";

export const HOME_TOUR_STEPS = [
  {
    id: "home.daily-drop",
    targetId: "home.hero",
    titleKey: "onboarding.home.dailyDrop.title",
    descriptionKey: "onboarding.home.dailyDrop.description",
    placement: "bottom",
  },
  {
    id: "home.djs",
    targetId: "home.djs",
    titleKey: "onboarding.home.djs.title",
    descriptionKey: "onboarding.home.djs.description",
    placement: "top",
  },
  {
    id: "home.discover",
    targetId: "tabs.discover",
    titleKey: "onboarding.home.discover.title",
    descriptionKey: "onboarding.home.discover.description",
    placement: "top",
  },
] as const satisfies readonly SpotlightStepDefinition[];

export const CONTEXTUAL_TIP_COPY: Record<
  ContextualTipId,
  Pick<SpotlightStepDefinition, "titleKey" | "descriptionKey" | "placement">
> = {
  "discover.search": {
    titleKey: "onboarding.contextual.discoverSearch.title",
    descriptionKey: "onboarding.contextual.discoverSearch.description",
    placement: "bottom",
  },
  "dj.hero": {
    titleKey: "onboarding.contextual.djHero.title",
    descriptionKey: "onboarding.contextual.djHero.description",
    placement: "bottom",
  },
};
