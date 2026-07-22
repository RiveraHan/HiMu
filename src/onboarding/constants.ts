import type { ContextualTipId, SpotlightStep } from "./types";

export const ONBOARDING_VERSION = 1;
export const ONBOARDING_STORAGE_PREFIX = "himu:onboarding";

export const HOME_TOUR_STEPS = [
  {
    id: "home.daily-drop",
    targetId: "home.hero",
    title: "START HERE",
    description: "Your Daily Drop is a fresh track selected for this moment.",
    placement: "bottom",
  },
  {
    id: "home.djs",
    targetId: "home.djs",
    title: "DIFFERENT MINDS, DIFFERENT SOUNDS",
    description: "Each AI DJ has a distinct sound and personality.",
    placement: "top",
  },
  {
    id: "home.discover",
    targetId: "tabs.discover",
    title: "GO BEYOND YOUR FEED",
    description: "Search and explore more music whenever you want.",
    placement: "top",
  },
] as const satisfies readonly SpotlightStep[];

export const CONTEXTUAL_TIP_COPY: Record<
  ContextualTipId,
  Pick<SpotlightStep, "title" | "description" | "placement">
> = {
  "discover.search": {
    title: "SEARCH THE WHOLE SOUND",
    description: "Find tracks, moods, and artists beyond your Home feed.",
    placement: "bottom",
  },
  "dj.hero": {
    title: "GET TO KNOW YOUR DJ",
    description:
      "Each DJ has a personality, sound, and evolving relationship with your taste.",
    placement: "bottom",
  },
};
