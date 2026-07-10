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
import { useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

const REGEN_PHASES = [
  "Sketching a new look…",
  "Composing the portrait…",
  "Almost there…",
] as const;

type DJData = NonNullable<ReturnType<typeof useDJ>["data"]>;

function RegenStatus() {
  const phase = usePhaseRotation(REGEN_PHASES, 4000);

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
        <Text variant="h2">DJ not found</Text>
      </View>
    );
  }

  return <TrainForm djId={id} dj={dj} />;
}

function TrainForm({ djId, dj }: { djId: string; dj: DJData }) {
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
              "Portrait",
              "Portrait couldn't be regenerated — your changes were saved.",
            );
          }
          // New portrait arrives via the ["djs"] invalidation refetch.
        },
        onError: async (e) => {
          const code = await getEdgeErrorCode(e);
          if (code === "not_owner" || code === "not_found") {
            toast.warning("Not available", "This DJ can't be edited.");
            router.back();
            return;
          }
          toast.error(
            "Couldn't save",
            code === "avatar_quota_reached"
              ? "Daily portrait limit reached (3). Try again tomorrow."
              : code === "invalid_input"
                ? "Please check the fields and try again."
                : "Something went wrong. Please try again.",
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
          title="Train your DJ"
          subtitle={`Refine how ${dj.name} shapes its music.`}
          disabled={isPending}
        />

        {/* Portrait */}
        <PrefSection
          title="Portrait"
          subtitle="Regenerated from the traits below"
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
                label="Regenerate portrait"
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
          label="Save changes"
          loadingLabel="Saving…"
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
