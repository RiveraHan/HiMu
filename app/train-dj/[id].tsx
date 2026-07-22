import { getEdgeErrorCode } from "@/src/api/edge-errors";
import {
  Avatar,
  Button,
  canSubmitDjTraits,
  DjTraitsForm,
  EqualizerBars,
  PrefSection,
  ScreenHeader,
  Text,
  type DjTraits,
} from "@/src/components";
import { useDJ } from "@/src/hooks/use-dj";
import { usePhaseRotation } from "@/src/hooks/use-phase-rotation";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { useToast } from "@/src/hooks/use-toast";
import { useUpdateDJ } from "@/src/hooks/use-update-dj";
import { router, useLocalSearchParams } from "expo-router";
import { RefreshCw } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
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
  const { data: dj, isLoading } = useDJ(id);
  const { theme } = useUnistyles();

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!dj || !dj.owner_id) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text variant="h2">{t("dj.train.notFound")}</Text>
      </View>
    );
  }

  return <TrainForm djId={id} dj={dj} />;
}

function TrainForm({ djId, dj }: { djId: string; dj: DJData }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const { theme } = useUnistyles();
  const toast = useToast();

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
        onSuccess: (data) => {
          if (!regenerateAvatar) {
            router.back();
            return;
          }
          if (data.avatarUrl === null) {
            toast.warning(
              t("dj.train.portraitWarningTitle"),
              t("dj.train.portraitWarning"),
            );
          }
          // New portrait arrives via the ["djs"] invalidation refetch.
        },
        onError: async (e) => {
          const code = await getEdgeErrorCode(e);
          if (code === "not_owner" || code === "not_found") {
            toast.warning(
              t("dj.train.unavailableTitle"),
              t("dj.train.unavailable"),
            );
            router.back();
            return;
          }
          toast.error(
            t("dj.train.errorTitle"),
            code === "avatar_quota_reached"
              ? t("dj.train.quotaError")
              : code === "invalid_input"
                ? t("dj.train.invalidError")
                : t("dj.train.genericError"),
          );
        },
      },
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title={t("dj.train.title")}
          subtitle={t("dj.train.subtitle", { name: dj.name })}
          disabled={isPending}
        />

        {/* Portrait */}
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
                leftIcon={
                  <RefreshCw size={16} color={theme.colors.onSurface} />
                }
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
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
