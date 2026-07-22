import { common as enCommon } from "./locales/en/common";
import { settings as enSettings } from "./locales/en/settings";
import { common as esCommon } from "./locales/es/common";
import { settings as esSettings } from "./locales/es/settings";

export const en = { common: enCommon, settings: enSettings } as const;
export const es = { common: esCommon, settings: esSettings } as const;
export const resources = { en: { translation: en }, es: { translation: es } } as const;
