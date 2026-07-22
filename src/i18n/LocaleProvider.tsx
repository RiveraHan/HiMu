import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { getLocales } from "expo-localization";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useSettings, useUpdateSettings } from "@/src/hooks/use-settings";
import { useToastStore } from "@/src/stores/toast-store";
import i18n from "./index";
import { resolveLanguage } from "./locale";
import {
  readLanguageState,
  writeLanguageState,
  type StoredLanguageState,
} from "./locale-storage";
import type { LanguagePreference } from "./types";
import { LocaleContext } from "./use-locale";

function showPersistenceError() {
  useToastStore
    .getState()
    .show(
      "error",
      i18n.t("common.errors.generic"),
      i18n.t("common.errors.savePreference"),
    );
}

export function LocaleProvider({ children }: PropsWithChildren) {
  const user = useCurrentUser();
  const userId = user?.id ?? null;
  const { data: settings } = useSettings();
  const { mutateAsync: updateSettings } = useUpdateSettings();
  const deviceLanguageCode = useMemo(
    () => getLocales()[0]?.languageCode,
    [],
  );
  const [preference, setPreferenceState] =
    useState<LanguagePreference>("system");
  const [localState, setLocalState] = useState<StoredLanguageState | null>(null);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const syncInFlightRef = useRef(false);
  const syncGenerationRef = useRef(0);
  const pendingAttemptRef = useRef<string | null>(null);
  const appliedRemoteRef = useRef<string | null>(null);

  const applyPreference = useCallback(
    (next: LanguagePreference) => {
      setPreferenceState(next);
      void i18n.changeLanguage(resolveLanguage(next, deviceLanguageCode));
    },
    [deviceLanguageCode],
  );

  useEffect(() => {
    let cancelled = false;
    syncGenerationRef.current += 1;
    syncInFlightRef.current = false;
    pendingAttemptRef.current = null;
    appliedRemoteRef.current = null;
    setIsSaving(false);

    if (!userId) {
      setHydratedUserId(null);
      setLocalState(null);
      applyPreference("system");
      return () => {
        cancelled = true;
      };
    }

    setHydratedUserId(null);
    setLocalState(null);

    void readLanguageState(userId).then((stored) => {
      if (cancelled) return;
      setLocalState(stored);
      applyPreference(stored?.preference ?? "system");
      setHydratedUserId(userId);
    });

    return () => {
      cancelled = true;
    };
  }, [applyPreference, userId]);

  useEffect(() => {
    if (
      !userId ||
      hydratedUserId !== userId ||
      !settings ||
      syncInFlightRef.current
    ) {
      return;
    }

    if (localState?.pendingSync) {
      const attemptKey = `${userId}:${localState.preference}:${settings.language}`;
      if (pendingAttemptRef.current === attemptKey) return;
      pendingAttemptRef.current = attemptKey;
      syncInFlightRef.current = true;
      const syncGeneration = ++syncGenerationRef.current;
      setIsSaving(true);

      void (async () => {
        try {
          try {
            await updateSettings({
              ...settings,
              language: localState.preference,
            });
          } catch {
            showPersistenceError();
            return;
          }

          if (syncGenerationRef.current !== syncGeneration) return;

          try {
            await writeLanguageState(userId, {
              preference: localState.preference,
              pendingSync: false,
            });
            appliedRemoteRef.current = `${userId}:${settings.language}`;
            setLocalState({
              preference: localState.preference,
              pendingSync: false,
            });
          } catch {
            showPersistenceError();
          }
        } finally {
          if (syncGenerationRef.current === syncGeneration) {
            syncInFlightRef.current = false;
            setIsSaving(false);
          }
        }
      })();
      return;
    }

    const remoteKey = `${userId}:${settings.language}`;
    if (appliedRemoteRef.current === remoteKey) return;
    appliedRemoteRef.current = remoteKey;

    const cleanState: StoredLanguageState = {
      preference: settings.language,
      pendingSync: false,
    };
    setLocalState(cleanState);
    applyPreference(settings.language);
    void writeLanguageState(userId, cleanState).catch(showPersistenceError);
  }, [
    applyPreference,
    hydratedUserId,
    localState,
    settings,
    updateSettings,
    userId,
  ]);

  const setPreference = useCallback(
    async (next: LanguagePreference) => {
      applyPreference(next);
      if (!userId) return;

      const pendingState: StoredLanguageState = {
        preference: next,
        pendingSync: true,
      };
      setLocalState(pendingState);
      syncInFlightRef.current = true;
      const syncGeneration = ++syncGenerationRef.current;
      setIsSaving(true);

      try {
        await writeLanguageState(userId, pendingState);
      } catch {
        showPersistenceError();
      }

      if (syncGenerationRef.current !== syncGeneration) return;

      if (!settings) {
        syncInFlightRef.current = false;
        setIsSaving(false);
        return;
      }

      pendingAttemptRef.current = `${userId}:${next}:${settings.language}`;

      try {
        await updateSettings({ ...settings, language: next });
        if (syncGenerationRef.current !== syncGeneration) return;

        const cleanState: StoredLanguageState = {
          preference: next,
          pendingSync: false,
        };
        try {
          await writeLanguageState(userId, cleanState);
          appliedRemoteRef.current = `${userId}:${settings.language}`;
          setLocalState(cleanState);
        } catch {
          showPersistenceError();
        }
      } catch {
        showPersistenceError();
      } finally {
        if (syncGenerationRef.current === syncGeneration) {
          syncInFlightRef.current = false;
          setIsSaving(false);
        }
      }
    },
    [applyPreference, settings, updateSettings, userId],
  );

  const value = useMemo(
    () => ({
      preference,
      resolvedLanguage: resolveLanguage(preference, deviceLanguageCode),
      setPreference,
      isSaving,
    }),
    [deviceLanguageCode, isSaving, preference, setPreference],
  );

  if (userId && hydratedUserId !== userId) return null;

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
