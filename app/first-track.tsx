import { router } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
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
  const userId = useCurrentUser()?.id ?? null;
  const ownedDjs = useOwnedDjs();
  const currentUserIdRef = useRef(userId);
  const routedUserIdRef = useRef<string | null>(null);
  const cancelStartedRef = useRef(false);
  const mountedRef = useRef(true);
  currentUserIdRef.current = userId;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (
      !userId ||
      !ownedDjs.isSuccess ||
      ownedDjs.data === undefined ||
      cancelStartedRef.current ||
      routedUserIdRef.current === userId
    ) {
      return;
    }

    routedUserIdRef.current = userId;
    const destination = resolveFirstTrackDestination(ownedDjs.data);

    const route = async () => {
      if (destination.kind === "create_dj") {
        void trackProductEvent("first_track_gate_resolved", {
          ...eventProperties(),
          routeOutcome: "create_dj",
        });
        if (
          mountedRef.current &&
          !cancelStartedRef.current &&
          currentUserIdRef.current === userId
        ) {
          router.replace({
            pathname: "/create-dj",
            params: { returnIntent: "first_track" },
          });
        }
        return;
      }

      try {
        await pendingIntentStore.consume("first_track", Date.now());
      } catch {
        // Routing remains available after a best-effort storage cleanup.
      }
      if (
        !mountedRef.current ||
        cancelStartedRef.current ||
        currentUserIdRef.current !== userId
      ) return;

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
    };

    void route();
  }, [ownedDjs.data, ownedDjs.isSuccess, userId]);

  const cancel = useCallback(async () => {
    if (cancelStartedRef.current) return;
    cancelStartedRef.current = true;
    const cancelUserId = currentUserIdRef.current;
    try {
      await pendingIntentStore.clear();
    } catch {
      // Cancellation navigation must not be trapped by unavailable storage.
    }
    if (
      !mountedRef.current ||
      !cancelUserId ||
      currentUserIdRef.current !== cancelUserId
    ) {
      return;
    }
    void trackProductEvent("first_track_intent_cancelled", {
      ...eventProperties(),
      routeOutcome: "home",
    });
    router.replace("/(app)");
  }, []);

  const content = ownedDjs.isError ? (
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
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + theme.spacing.gutter,
          paddingBottom: insets.bottom + theme.spacing.gutter,
        },
      ]}
    >
      <View style={styles.card}>
        {content}
        <Button
          variant="ghost"
          label={t("common.actions.cancel")}
          onPress={() => void cancel()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.gutter,
    backgroundColor: theme.colors.background,
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
