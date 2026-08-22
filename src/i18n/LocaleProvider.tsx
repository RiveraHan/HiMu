import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { getLocales } from "expo-localization";
import { AppState, type AppStateStatus } from "react-native";
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
import { isCurrentMutationUser } from "@/src/api/auth-scope";

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
  const [saveError, setSaveError] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const syncInFlightRef = useRef(false);
  const syncGenerationRef = useRef(0);
  const pendingAttemptRef = useRef<string | null>(null);
  const appliedRemoteRef = useRef<string | null>(null);
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const mountedRef = useRef(true);

  const scopeIsCurrent = useCallback(
    (generation: number, capturedUserId: string) =>
      mountedRef.current &&
      syncGenerationRef.current === generation &&
      isCurrentMutationUser(capturedUserId),
    [],
  );

  useEffect(
    () => () => {
      mountedRef.current = false;
      syncGenerationRef.current += 1;
    },
    [],
  );

  const enqueuePersistence = useCallback(
    (operation: () => Promise<void>) => {
      const queued = persistenceQueueRef.current
        .catch(() => undefined)
        .then(operation);
      persistenceQueueRef.current = queued;
      return queued;
    },
    [],
  );

  const applyPreference = useCallback(
    (next: LanguagePreference) => {
      setPreferenceState(next);
      void i18n.changeLanguage(resolveLanguage(next, deviceLanguageCode));
    },
    [deviceLanguageCode],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (
        nextState === "active" &&
        (previousState === "background" || previousState === "inactive")
      ) {
        pendingAttemptRef.current = null;
        setRetryVersion((version) => version + 1);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    syncGenerationRef.current += 1;
    syncInFlightRef.current = false;
    pendingAttemptRef.current = null;
    appliedRemoteRef.current = null;
    setIsSaving(false);
    setSaveError(false);

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
    const hydrationGeneration = syncGenerationRef.current;

    void readLanguageState(userId).then((stored) => {
      if (
        cancelled ||
        !scopeIsCurrent(hydrationGeneration, userId)
      ) return;
      setLocalState(stored);
      applyPreference(stored?.preference ?? "system");
      setHydratedUserId(userId);
    });

    return () => {
      cancelled = true;
    };
  }, [applyPreference, scopeIsCurrent, userId]);

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

      void enqueuePersistence(async () => {
        if (!scopeIsCurrent(syncGeneration, userId)) return;

        try {
          try {
            await updateSettings({ language: localState.preference });
          } catch {
            if (scopeIsCurrent(syncGeneration, userId)) {
              setSaveError(true);
              showPersistenceError();
            }
            return;
          }

          if (!scopeIsCurrent(syncGeneration, userId)) return;

          try {
            await writeLanguageState(userId, {
              preference: localState.preference,
              pendingSync: false,
            });
          } catch {
            if (scopeIsCurrent(syncGeneration, userId)) {
              setSaveError(true);
              showPersistenceError();
            }
            return;
          }

          if (!scopeIsCurrent(syncGeneration, userId)) return;

          appliedRemoteRef.current = `${userId}:${settings.language}`;
          setSaveError(false);
          setLocalState({
            preference: localState.preference,
            pendingSync: false,
          });
        } finally {
          if (scopeIsCurrent(syncGeneration, userId)) {
            syncInFlightRef.current = false;
            setIsSaving(false);
          }
        }
      });
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
    const cleanWriteGeneration = syncGenerationRef.current;
    void enqueuePersistence(async () => {
      if (!scopeIsCurrent(cleanWriteGeneration, userId)) return;
      try {
        await writeLanguageState(userId, cleanState);
      } catch {
        if (scopeIsCurrent(cleanWriteGeneration, userId)) {
          setSaveError(true);
          showPersistenceError();
        }
      }
    });
  }, [
    applyPreference,
    enqueuePersistence,
    hydratedUserId,
    localState,
    retryVersion,
    scopeIsCurrent,
    settings,
    updateSettings,
    userId,
  ]);

  const setPreference = useCallback(
    (next: LanguagePreference): Promise<void> => {
      setSaveError(false);
      applyPreference(next);
      if (!userId) return Promise.resolve();

      const pendingState: StoredLanguageState = {
        preference: next,
        pendingSync: true,
      };
      setLocalState(pendingState);
      syncInFlightRef.current = true;
      const syncGeneration = ++syncGenerationRef.current;
      setIsSaving(true);

      return enqueuePersistence(async () => {
        if (!scopeIsCurrent(syncGeneration, userId)) return;

        try {
          await writeLanguageState(userId, pendingState);
        } catch {
          if (scopeIsCurrent(syncGeneration, userId)) {
            setSaveError(true);
            showPersistenceError();
          }
        }

        if (!scopeIsCurrent(syncGeneration, userId)) return;

        if (!settings) {
          syncInFlightRef.current = false;
          setIsSaving(false);
          return;
        }

        pendingAttemptRef.current = `${userId}:${next}:${settings.language}`;

        try {
          try {
            await updateSettings({ language: next });
          } catch {
            if (scopeIsCurrent(syncGeneration, userId)) {
              setSaveError(true);
              showPersistenceError();
            }
            return;
          }

          if (!scopeIsCurrent(syncGeneration, userId)) return;

          const cleanState: StoredLanguageState = {
            preference: next,
            pendingSync: false,
          };
          try {
            await writeLanguageState(userId, cleanState);
          } catch {
            if (scopeIsCurrent(syncGeneration, userId)) {
              setSaveError(true);
              showPersistenceError();
            }
            return;
          }

          if (!scopeIsCurrent(syncGeneration, userId)) return;

          appliedRemoteRef.current = `${userId}:${settings.language}`;
          setSaveError(false);
          setLocalState(cleanState);
        } finally {
          if (scopeIsCurrent(syncGeneration, userId)) {
            syncInFlightRef.current = false;
            setIsSaving(false);
          }
        }
      });
    },
    [
      applyPreference,
      enqueuePersistence,
      scopeIsCurrent,
      settings,
      updateSettings,
      userId,
    ],
  );

  const retryPreference = useCallback(() => {
    pendingAttemptRef.current = null;
    appliedRemoteRef.current = null;
    setSaveError(false);
    setRetryVersion((version) => version + 1);
  }, []);

  const value = useMemo(
    () => ({
      preference,
      resolvedLanguage: resolveLanguage(preference, deviceLanguageCode),
      setPreference,
      isSaving,
      saveError,
      retryPreference,
    }),
    [
      deviceLanguageCode,
      isSaving,
      preference,
      retryPreference,
      saveError,
      setPreference,
    ],
  );

  if (userId && hydratedUserId !== userId) return null;

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
