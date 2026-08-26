import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/Button";
import { StateNotice } from "@/src/components/StateNotice";
import { Text } from "@/src/components/Text";
import {
  pendingIntentStore,
  PUBLIC_INTRO_VERSION,
  trackProductEvent,
} from "@/src/experience";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useOwnedDjs } from "@/src/hooks/use-owned-djs";
import i18n from "@/src/i18n";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";

type FirstTrackDestination =
  | { kind: "create_dj" }
  | { kind: "create_track"; djId: string; anomaly: boolean };

type OwnedFirstTrackDestination = Extract<
  FirstTrackDestination,
  { kind: "create_track" }
>;

type StorageResolutionError = {
  userId: string;
  operation: "read" | "consume" | "clear";
};

export function resolveFirstTrackDestination(
  rows: readonly { id: string }[],
): FirstTrackDestination {
  if (rows.length === 0) return { kind: "create_dj" };
  return {
    kind: "create_track",
    djId: rows[0]!.id,
    anomaly: rows.length > 1,
  };
}

function eventProperties() {
  return {
    flowVersion: PUBLIC_INTRO_VERSION,
    platform: Platform.OS === "web"
      ? "web" as const
      : Platform.OS === "android"
        ? "android" as const
        : "ios" as const,
    locale: i18n.resolvedLanguage === "es" ? "es" as const : "en" as const,
  };
}

export function FirstTrackGate() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const compactHeight = height - insets.top - insets.bottom < 600 || fontScale >= 1.5;
  const userId = useCurrentUser()?.id ?? null;
  const ownedDjs = useOwnedDjs();
  const [storageError, setStorageError] = useState<StorageResolutionError | null>(
    null,
  );
  const [validatedIntentUserId, setValidatedIntentUserId] = useState<
    string | null
  >(null);
  const currentUserIdRef = useRef(userId);
  const controllerUserIdRef = useRef(userId);
  const routedUserIdRef = useRef<string | null>(null);
  const ownedDestinationRef = useRef<{
    userId: string;
    destination: OwnedFirstTrackDestination;
  } | null>(null);
  const readFlightRef = useRef<Promise<void> | null>(null);
  const consumeFlightRef = useRef<Promise<void> | null>(null);
  const clearFlightRef = useRef<Promise<void> | null>(null);
  const cancelRequestedRef = useRef(false);
  const navigationCompletedRef = useRef(false);
  const mountedRef = useRef(true);

  if (controllerUserIdRef.current !== userId) {
    controllerUserIdRef.current = userId;
    routedUserIdRef.current = null;
    ownedDestinationRef.current = null;
    readFlightRef.current = null;
    consumeFlightRef.current = null;
    clearFlightRef.current = null;
    cancelRequestedRef.current = false;
    navigationCompletedRef.current = false;
  }
  currentUserIdRef.current = userId;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const validatePendingIntent = useCallback((readUserId: string) => {
    if (
      !mountedRef.current ||
      currentUserIdRef.current !== readUserId ||
      cancelRequestedRef.current ||
      navigationCompletedRef.current ||
      readFlightRef.current ||
      validatedIntentUserId === readUserId
    ) {
      return;
    }

    setStorageError((current) =>
      current?.userId === readUserId ? null : current
    );

    const flight = (async () => {
      try {
        const intent = await pendingIntentStore.read(Date.now());
        if (
          !mountedRef.current ||
          currentUserIdRef.current !== readUserId ||
          cancelRequestedRef.current ||
          navigationCompletedRef.current
        ) {
          return;
        }

        if (intent === null) {
          navigationCompletedRef.current = true;
          setStorageError(null);
          router.replace("/(app)");
          return;
        }

        setStorageError(null);
        setValidatedIntentUserId(readUserId);
      } catch {
        if (
          mountedRef.current &&
          currentUserIdRef.current === readUserId &&
          !cancelRequestedRef.current &&
          !navigationCompletedRef.current
        ) {
          setStorageError({ userId: readUserId, operation: "read" });
        }
      }
    })();

    readFlightRef.current = flight;
    void flight.then(() => {
      if (readFlightRef.current === flight) {
        readFlightRef.current = null;
      }
    });
  }, [validatedIntentUserId]);

  useEffect(() => {
    if (userId) validatePendingIntent(userId);
  }, [userId, validatePendingIntent]);

  const consumeOwnedIntent = useCallback((
    consumeUserId: string,
    destination: OwnedFirstTrackDestination,
  ) => {
    if (
      !mountedRef.current ||
      currentUserIdRef.current !== consumeUserId ||
      cancelRequestedRef.current ||
      navigationCompletedRef.current ||
      consumeFlightRef.current
    ) {
      return;
    }

    setStorageError((current) =>
      current?.userId === consumeUserId ? null : current
    );

    const flight = (async () => {
      let consumed = false;
      try {
        consumed = await pendingIntentStore.consume("first_track", Date.now());
      } catch {
        consumed = false;
      }

      if (
        !mountedRef.current ||
        currentUserIdRef.current !== consumeUserId ||
        cancelRequestedRef.current ||
        navigationCompletedRef.current
      ) {
        return;
      }

      if (consumed !== true) {
        setStorageError({ userId: consumeUserId, operation: "consume" });
        return;
      }

      navigationCompletedRef.current = true;
      setStorageError(null);
      void trackProductEvent("first_track_gate_resolved", {
        ...eventProperties(),
        routeOutcome: destination.anomaly
          ? "multiple_djs_create_track"
          : "create_track",
      });
      router.replace({
        pathname: "/create-track",
        params: { djId: destination.djId },
      });
    })();

    consumeFlightRef.current = flight;
    void flight.then(() => {
      if (consumeFlightRef.current === flight) {
        consumeFlightRef.current = null;
      }
    });
  }, []);

  const clearPendingIntent = useCallback((clearUserId: string) => {
    if (
      !mountedRef.current ||
      currentUserIdRef.current !== clearUserId ||
      navigationCompletedRef.current
    ) {
      return;
    }

    cancelRequestedRef.current = true;
    if (clearFlightRef.current) return;

    setStorageError((current) =>
      current?.userId === clearUserId ? null : current
    );

    const flight = (async () => {
      let cleared = false;
      try {
        await pendingIntentStore.clear();
        cleared = true;
      } catch {
        cleared = false;
      }

      if (
        !mountedRef.current ||
        currentUserIdRef.current !== clearUserId ||
        navigationCompletedRef.current
      ) {
        return;
      }

      if (!cleared) {
        setStorageError({ userId: clearUserId, operation: "clear" });
        return;
      }

      navigationCompletedRef.current = true;
      setStorageError(null);
      void trackProductEvent("first_track_intent_cancelled", {
        ...eventProperties(),
        routeOutcome: "home",
      });
      router.replace("/(app)");
    })();

    clearFlightRef.current = flight;
    void flight.then(() => {
      if (clearFlightRef.current === flight) {
        clearFlightRef.current = null;
      }
    });
  }, []);

  useEffect(() => {
    if (
      !userId ||
      validatedIntentUserId !== userId ||
      !ownedDjs.isSuccess ||
      ownedDjs.data === undefined ||
      cancelRequestedRef.current ||
      navigationCompletedRef.current ||
      routedUserIdRef.current === userId
    ) {
      return;
    }

    routedUserIdRef.current = userId;
    const destination = resolveFirstTrackDestination(ownedDjs.data);

    if (destination.kind === "create_dj") {
      navigationCompletedRef.current = true;
      void trackProductEvent("first_track_gate_resolved", {
        ...eventProperties(),
        routeOutcome: "create_dj",
      });
      router.replace({
        pathname: "/create-dj",
        params: { returnIntent: "first_track" },
      });
      return;
    }

    ownedDestinationRef.current = { userId, destination };
    consumeOwnedIntent(userId, destination);
  }, [
    consumeOwnedIntent,
    ownedDjs.data,
    ownedDjs.isSuccess,
    userId,
    validatedIntentUserId,
  ]);

  const activeStorageError = storageError?.userId === userId
    ? storageError.operation
    : null;

  const retryStorageResolution = useCallback((
    retryUserId: string,
    operation: StorageResolutionError["operation"],
  ) => {
    if (operation === "read") {
      validatePendingIntent(retryUserId);
      return;
    }

    if (operation === "clear") {
      clearPendingIntent(retryUserId);
      return;
    }

    const ownedDestination = ownedDestinationRef.current;
    if (ownedDestination?.userId === retryUserId) {
      consumeOwnedIntent(retryUserId, ownedDestination.destination);
    }
  }, [clearPendingIntent, consumeOwnedIntent, validatePendingIntent]);

  const content = activeStorageError ? (
    <StateNotice
      kind="error"
      title={t("onboarding.firstTrack.storageUnavailable")}
      actionLabel={t("common.actions.retry")}
      onAction={() => {
        if (userId) retryStorageResolution(userId, activeStorageError);
      }}
    />
  ) : ownedDjs.isError ? (
    <StateNotice
      kind="error"
      title={t("onboarding.firstTrack.unavailable")}
      actionLabel={t("common.actions.retry")}
      onAction={() => void ownedDjs.refetch()}
    />
  ) : (
    <View style={styles.loadingCopy}>
      <ActivityIndicator
        accessible
        accessibilityLabel={t("onboarding.firstTrack.checking")}
        accessibilityRole="progressbar"
        color={theme.colors.primary}
      />
      <Text color="onSurfaceVariant" variant="bodyMd">
        {t("onboarding.firstTrack.checking")}
      </Text>
    </View>
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        compactHeight ? styles.contentCompact : styles.contentCentered,
        {
          paddingTop: insets.top + theme.spacing.gutter,
          paddingRight: insets.right + theme.spacing.gutter,
          paddingBottom: insets.bottom + theme.spacing.gutter,
          paddingLeft: insets.left + theme.spacing.gutter,
        },
      ]}
      style={styles.root}
      testID="first-track-scroll"
    >
      <View style={styles.card} testID="first-track-card">
        {content}
        <Button
          variant="ghost"
          label={t("common.actions.cancel")}
          onPress={() => {
            if (userId) clearPendingIntent(userId);
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
  },
  contentCentered: {
    justifyContent: "center",
  },
  contentCompact: {
    justifyContent: "flex-start",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    gap: theme.spacing.stackMd,
  },
  loadingCopy: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.stackSm,
  },
}));

export default FirstTrackGate;
