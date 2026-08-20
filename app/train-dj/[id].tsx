import {
  Avatar,
  Button,
  canSubmitDjTraits,
  DjTraitsForm,
  EqualizerBars,
  PrefSection,
  ScreenHeader,
  ScreenScrollView,
  StateNotice,
  Text,
  TrainDjSkeleton,
  type DjTraits,
} from "@/src/components";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useDJ } from "@/src/hooks/use-dj";
import { useOnlineStatus } from "@/src/hooks/use-online-status";
import { usePhaseRotation } from "@/src/hooks/use-phase-rotation";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { useUpdateDJ } from "@/src/hooks/use-update-dj";
import { isInitialQueryLoading } from "@/src/utils/query-state";
import { router, useLocalSearchParams } from "expo-router";
import { RefreshCw } from "lucide-react-native";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useTranslation } from "react-i18next";

type DJData = NonNullable<ReturnType<typeof useDJ>["data"]>;

function RegenStatus() {
  const { t } = useTranslation();
  const phases = useMemo(
    () => [
      t("dj.train.phases.sketch"),
      t("dj.train.phases.portrait"),
      t("dj.train.phases.almost"),
    ],
    [t],
  );
  const phase = usePhaseRotation(phases, 4000);

  return (
    <View style={styles.regenStatus}>
      <EqualizerBars bars={4} height={16} />
      <Text variant="labelCaps" color="onSurfaceVariant" opacity={0.8}>
        {phase}
      </Text>
    </View>
  );
}

export default function TrainDJScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const djQuery = useDJ(id);
  const dj = djQuery.data;
  const user = useCurrentUser();
  const online = useOnlineStatus();
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const { theme } = useUnistyles();
  const offlineWithoutDj =
    !online && djQuery.fetchStatus === "paused" && dj === undefined;
  const djLoading = isInitialQueryLoading(djQuery);
  const blockingDjError = djQuery.isError && dj === undefined;
  const fallbackHref = dj ? (`/dj/${dj.id}` as const) : "/";

  return (
    <ScreenScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <ScreenHeader
        title={t("dj.train.title")}
        subtitle={dj ? t("dj.train.subtitle", { name: dj.name }) : undefined}
        fallbackHref={fallbackHref}
      />

      {offlineWithoutDj ? (
        <StateNotice
          kind="offline"
          title={t("common.errors.offline")}
          message={t("common.errors.reconnect")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void djQuery.refetch()}
        />
      ) : djLoading ? (
        <TrainDjSkeleton />
      ) : blockingDjError ? (
        <StateNotice
          kind="error"
          title={t("dj.train.loadUnavailableTitle")}
          message={t("dj.train.loadUnavailable")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void djQuery.refetch()}
        />
      ) : djQuery.isSuccess && dj === null ? (
        <StateNotice kind="empty" title={t("dj.train.notFound")} />
      ) : !dj ? (
        <StateNotice
          kind="error"
          title={t("dj.train.loadUnavailableTitle")}
          message={t("dj.train.loadUnavailable")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void djQuery.refetch()}
        />
      ) : dj.owner_id !== user?.id ? (
        <StateNotice kind="empty" title={t("dj.train.unavailable")} />
      ) : (
        <>
          <TrainForm djId={id} dj={dj} />
          {djQuery.isError || !online ? (
            <StateNotice
              compact
              kind={online ? "error" : "offline"}
              title={
                online
                  ? t("dj.train.loadUnavailableTitle")
                  : t("common.errors.offline")
              }
              message={online ? t("dj.train.loadUnavailable") : undefined}
              actionLabel={t("common.actions.retry")}
              onAction={() => void djQuery.refetch()}
            />
          ) : null}
        </>
      )}
    </ScreenScrollView>
  );
}

function TrainForm({ djId, dj }: { djId: string; dj: DJData }) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  const saved = (dj.personality_traits ?? {}) as {
    energy?: number;
    vibe?: string | null;
    isInstrumental?: boolean;
  };

  const [traits, setTraits] = useState<DjTraits>({
    name: dj.name,
    genres: dj.genre_specialties ?? [],
    moods: dj.mood_tags ?? [],
    energy: saved.energy ?? 5,
    mode: saved.isInstrumental === false ? "vocal" : "instrumental",
    vibe: saved.vibe ?? "",
  });
  const [action, setAction] = useState<"save" | "regen" | null>(null);

  const { mutate: updateDJ, isPending } = useUpdateDJ();
  const regenerating = isPending && action === "regen";

  const patch = (p: Partial<DjTraits>) => setTraits((t) => ({ ...t, ...p }));
  const canSubmit = canSubmitDjTraits(traits);

  function submit(regenerateAvatar: boolean) {
    setAction(regenerateAvatar ? "regen" : "save");
    updateDJ(
      {
        djId,
        name: traits.name.trim(),
        genres: traits.genres,
        moods: traits.moods,
        energy: traits.energy,
        isInstrumental: traits.mode === "instrumental",
        vibe: traits.vibe.trim() || undefined,
        regenerateAvatar,
      },
      {
        onSuccess: () => {
          if (!regenerateAvatar) {
            router.back();
          }
          // New portrait arrives via the ["djs"] invalidation refetch.
        },
      },
    );
  }

  return (
    <>
      <PrefSection
        title={t("dj.train.portrait")}
        subtitle={t("dj.train.portraitSubtitle")}
      >
        <View style={styles.portraitRow}>
          <View style={regenerating && styles.portraitDim}>
            <Avatar src={dj.avatar_url} fallback={dj.name} size="2xl" />
          </View>
          {regenerating ? (
            <RegenStatus />
          ) : (
            <Button
              variant="glass"
              label={t("dj.train.regenerate")}
              leftIcon={<RefreshCw size={16} color={theme.colors.onSurface} />}
              onPress={() => submit(true)}
              disabled={!canSubmit || isPending}
              style={styles.regenBtn}
            />
          )}
        </View>
      </PrefSection>

      <DjTraitsForm values={traits} onChange={patch} disabled={isPending} />

      <Button
        label={t("dj.train.save")}
        loadingLabel={t("dj.train.saving")}
        loading={isPending && action === "save"}
        disabled={!canSubmit || isPending}
        onPress={() => submit(false)}
      />
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.pageMargin,
    gap: theme.spacing.stackLg,
  },
  portraitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.gutter,
  },
  portraitDim: {
    opacity: 0.4,
  },
  regenStatus: {
    flex: 1,
    gap: theme.spacing.stackSm,
    alignItems: "flex-start",
  },
  regenBtn: {
    flex: 1,
  },
}));
