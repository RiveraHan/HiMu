import { createContext, useContext } from "react";
import type { LanguagePreference, SupportedLanguage } from "./types";

export type LocaleContextValue = {
  preference: LanguagePreference;
  resolvedLanguage: SupportedLanguage;
  setPreference: (preference: LanguagePreference) => Promise<void>;
  isSaving: boolean;
  saveError?: boolean;
  retryPreference?: () => void;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return value;
}
