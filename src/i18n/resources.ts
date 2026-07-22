import { common as enCommon } from "./locales/en/common";
import { common as esCommon } from "./locales/es/common";

export const en = { common: enCommon } as const;
export const es = { common: esCommon } as const;
export const resources = { en: { translation: en }, es: { translation: es } } as const;
