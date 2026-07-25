import { common as enCommon } from "./locales/en/common";
import { dj as enDj } from "./locales/en/dj";
import { discover as enDiscover } from "./locales/en/discover";
import { home as enHome } from "./locales/en/home";
import { onboarding as enOnboarding } from "./locales/en/onboarding";
import { profile as enProfile } from "./locales/en/profile";
import { playback as enPlayback } from "./locales/en/playback";
import { settings as enSettings } from "./locales/en/settings";
import { common as esCommon } from "./locales/es/common";
import { dj as esDj } from "./locales/es/dj";
import { discover as esDiscover } from "./locales/es/discover";
import { home as esHome } from "./locales/es/home";
import { onboarding as esOnboarding } from "./locales/es/onboarding";
import { profile as esProfile } from "./locales/es/profile";
import { playback as esPlayback } from "./locales/es/playback";
import { settings as esSettings } from "./locales/es/settings";

export const en = {
  common: enCommon,
  dj: enDj,
  discover: enDiscover,
  home: enHome,
  onboarding: enOnboarding,
  playback: enPlayback,
  profile: enProfile,
  settings: enSettings,
} as const;
export const es = {
  common: esCommon,
  dj: esDj,
  discover: esDiscover,
  home: esHome,
  onboarding: esOnboarding,
  playback: esPlayback,
  profile: esProfile,
  settings: esSettings,
} as const;
export const resources = { en: { translation: en }, es: { translation: es } } as const;
