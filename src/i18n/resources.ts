import { common as enCommon } from "./locales/en/common";
import { discover as enDiscover } from "./locales/en/discover";
import { home as enHome } from "./locales/en/home";
import { profile as enProfile } from "./locales/en/profile";
import { settings as enSettings } from "./locales/en/settings";
import { common as esCommon } from "./locales/es/common";
import { discover as esDiscover } from "./locales/es/discover";
import { home as esHome } from "./locales/es/home";
import { profile as esProfile } from "./locales/es/profile";
import { settings as esSettings } from "./locales/es/settings";

export const en = {
  common: enCommon,
  discover: enDiscover,
  home: enHome,
  profile: enProfile,
  settings: enSettings,
} as const;
export const es = {
  common: esCommon,
  discover: esDiscover,
  home: esHome,
  profile: esProfile,
  settings: esSettings,
} as const;
export const resources = { en: { translation: en }, es: { translation: es } } as const;
