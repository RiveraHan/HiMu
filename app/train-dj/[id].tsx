import { getEdgeErrorCode } from "@/src/api/edge-errors";
import {
  Avatar,
  Button,
  Chip,
  EqualizerBars,
  GlassInput,
  PrefSection,
  Segmented,
  Text,
  VibeSlider,
} from "@/src/components";
import { useDJ } from "@/src/hooks/use-dj";
import { usePhaseRotation } from "@/src/hooks/use-phase-rotation";
import { useUpdateDJ } from "@/src/hooks/use-update-dj";
import { DJ_MOODS, GENRES } from "@/src/types/music-preferences";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, RefreshCw } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

const MAX_PICKS = 3;

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
  const { theme } = useUnistyles();

  const traits = (dj.personality_traits ?? {}) as {
    energy?: number;
    vibe?: string | null;
    isInstrumental?: boolean;
  };

  const [name, setName] = useState(dj.name);
  const [genres, setGenres] = useState<string[]>(dj.genre_specialties ?? []);
  const [moods, setMoods] = useState<string[]>(dj.mood_tags ?? []);
  const [energy, setEnergy] = useState(traits.energy ?? 5);
  const [mode, setMode] = useState<"instrumental" | "vocal">(
    traits.isInstrumental === false ? "vocal" : "instrumental",
  );
  const [vibe, setVibe] = useState(traits.vibe ?? "");
  const [action, setAction] = useState<"save" | "regen" | null>(null);

  const { mutate: updateDJ, isPending } = useUpdateDJ();
  const regenerating = isPending && action === "regen";

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(
      list.includes(value)
        ? list.filter((v) => v !== value)
        : list.length >= MAX_PICKS
          ? list
          : [...list, value],
    );

  const canSubmit =
    name.trim().length >= 2 && genres.length > 0 && moods.length > 0;

  function submit(regenerateAvatar: boolean) {
    setAction(regenerateAvatar ? "regen" : "save");
    updateDJ(
      {
        djId,
        name: name.trim(),
        genres,
        moods,
        energy,
        isInstrumental: mode === "instrumental",
        vibe: vibe.trim() || undefined,
        regenerateAvatar,
      },
      {
        onSuccess: (data) => {
          if (!regenerateAvatar) {
            router.back();
            return;
          }
          if (data.avatarUrl === null) {
            Alert.alert(
              "Portrait",
              "Portrait couldn't be regenerated — your changes were saved.",
            );
          }
          // New portrait arrives via the ["djs"] invalidation refetch.
        },
        onError: async (e) => {
          const code = await getEdgeErrorCode(e);
          if (code === "not_owner" || code === "not_found") {
            Alert.alert("Not available", "This DJ can't be edited.");
            router.back();
            return;
          }
          Alert.alert(
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
          {
            paddingTop: insets.top + theme.spacing.stackMd,
            paddingBottom: insets.bottom + theme.spacing.stackLg,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.canGoBack() && router.back()}
            disabled={isPending}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <ChevronLeft size={24} color={theme.colors.onSurface} />
          </Pressable>
          <Text variant="h1">Train your DJ</Text>
          <Text variant="bodyMd" color="onSurfaceVariant">
            Refine how {dj.name} shapes its music.
          </Text>
        </View>

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

        {/* Identity */}
        <PrefSection title="Identity" subtitle="What should we call it?">
          <GlassInput
            placeholder="e.g. Lumen"
            value={name}
            onChangeText={setName}
            maxLength={24}
            autoCapitalize="words"
            editable={!isPending}
          />
        </PrefSection>

        {/* Genres */}
        <PrefSection title="Genres" subtitle={`Pick 1-${MAX_PICKS}`}>
          <View style={styles.chipWrap}>
            {GENRES.map((g) => (
              <Chip
                key={g}
                label={g}
                selected={genres.includes(g)}
                onPress={() => toggle(genres, setGenres, g)}
                disabled={isPending}
              />
            ))}
          </View>
        </PrefSection>

        {/* Moods */}
        <PrefSection title="Moods" subtitle={`Pick 1-${MAX_PICKS}`}>
          <View style={styles.chipWrap}>
            {DJ_MOODS.map((m) => (
              <Chip
                key={m}
                label={m}
                selected={moods.includes(m)}
                onPress={() => toggle(moods, setMoods, m)}
                disabled={isPending}
              />
            ))}
          </View>
        </PrefSection>

        {/* Energy */}
        <PrefSection title="Energy" subtitle={`${energy}/10`}>
          <VibeSlider
            leftLabel="CALM"
            rightLabel="INTENSE"
            value={energy}
            onCommit={setEnergy}
            minimumValue={1}
            maximumValue={10}
            step={1}
            disabled={isPending}
          />
        </PrefSection>

        {/* Sound */}
        <PrefSection
          title="Sound"
          subtitle="Vocal DJs can sing your own lyrics"
        >
          <Segmented<"instrumental" | "vocal">
            options={[
              { label: "INSTRUMENTAL", value: "instrumental" },
              { label: "VOCAL", value: "vocal" },
            ]}
            value={mode}
            onChange={setMode}
            disabled={isPending}
          />
        </PrefSection>

        {/* Vibe */}
        <PrefSection title="Vibe" subtitle="Optional - a hint of personality">
          <GlassInput
            placeholder="e.g. late-night rooftop textures"
            value={vibe}
            onChangeText={setVibe}
            maxLength={140}
            editable={!isPending}
          />
        </PrefSection>

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
  header: {
    gap: theme.spacing.stackSm,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.glassTint,
    borderRadius: theme.borderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    marginBottom: theme.spacing.stackSm,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.stackSm,
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
  pressed: {
    opacity: 0.6,
  },
}));
