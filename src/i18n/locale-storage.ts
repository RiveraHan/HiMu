import { secureStorage } from "@/src/lib/secure-storage";
import { isLanguagePreference } from "./locale";
import type { LanguagePreference } from "./types";

export type StoredLanguageState = {
  preference: LanguagePreference;
  pendingSync: boolean;
};

const keyFor = (userId: string) => `himu.language.${userId}`;

export async function readLanguageState(
  userId: string,
): Promise<StoredLanguageState | null> {
  try {
    const raw = await secureStorage.getItem(keyFor(userId));
    if (!raw) return null;

    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;

    const candidate = value as Record<string, unknown>;
    if (
      !isLanguagePreference(candidate.preference) ||
      typeof candidate.pendingSync !== "boolean"
    ) {
      return null;
    }

    return {
      preference: candidate.preference,
      pendingSync: candidate.pendingSync,
    };
  } catch {
    return null;
  }
}

export async function writeLanguageState(
  userId: string,
  state: StoredLanguageState,
): Promise<void> {
  await secureStorage.setItem(keyFor(userId), JSON.stringify(state));
}
