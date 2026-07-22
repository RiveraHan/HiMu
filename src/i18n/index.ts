import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resolveLanguage } from "./locale";
import { resources } from "./resources";

const deviceLanguageCode = getLocales()[0]?.languageCode;

void i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage("system", deviceLanguageCode),
  fallbackLng: "en",
  supportedLngs: ["en", "es"],
  interpolation: { escapeValue: false },
  returnNull: false,
  saveMissing: __DEV__,
  missingKeyHandler: (_languages, _namespace, key) => {
    if (__DEV__) console.warn(`[i18n] Missing translation: ${key}`);
  },
});

export default i18n;
