import type { SupportedLanguage } from "./types";

export function syncDocumentLanguage(language: SupportedLanguage): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
}
