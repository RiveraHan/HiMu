import {
  Chip,
  PrefSection,
  Segmented,
  Text,
  Toggle,
  VibeSlider,
} from "@/src/components";
import {
  useMusicPreferences,
  useUpdateMusicPreferences,
} from "@/src/hooks/use-music-preferences";
import {
  AiFrequency,
  DEFAULT_MUSIC_PREFERENCES,
  EXCLUDABLE_MOODS,
  GENRES,
} from "@/src/types/music-preferences";
import { router } from "expo-router";
import {
  AudioLines,
  Ban,
  ChevronLeft,
  SlidersHorizontal,
} from "lucide-react-native";
import { useMemo } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

const AI_OPTIONS: { label: string; value: AiFrequency }[] = [
  { label: "Low", value: "low" },
  { label: "Optimal", value: "optimal" },
  { label: "High", value: "high" },
];

export default function MusicPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const { data } = useMusicPreferences();
  const { mutate: update } = useUpdateMusicPreferences();

  const prefs = data ?? DEFAULT_MUSIC_PREFERENCES;
  const ready = !!data;

  const availableMoods = useMemo(
    () => EXCLUDABLE_MOODS.filter((m) => !prefs.excludedMoods.includes(m)),
    [prefs.excludedMoods],
  );

  const toggleGenre = (genre: string) => {
    const has = prefs.genres.includes(genre);

    update({
      ...prefs,
      genres: has
        ? prefs.genres.filter((g) => g !== genre)
        : [...prefs.genres, genre],
    });
  };

  const addMood = () => {
    if (availableMoods.length === 0) return;
    Alert.alert("Add Exclusion", undefined, [
      ...availableMoods.map((m) => ({
        text: m,
        onPress: () =>
          update({ ...prefs, excludedMoods: [...prefs.excludedMoods, m] }),
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const removeMood = (mood: string) =>
    update({
      ...prefs,
      excludedMoods: prefs.excludedMoods.filter((m) => m !== mood),
    });

  const setVibe =
    (key: "organicElectronic" | "melancholicEuphoric") => (v: number) =>
      update({ ...prefs, vibeMapping: { ...prefs.vibeMapping, [key]: v } });

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
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.canGoBack() && router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <ChevronLeft size={24} color={theme.colors.onSurface} />
          </Pressable>
          <View style={styles.headerText}>
            <Text variant="labelCaps" color="outline">
              TASTE PROFILE
            </Text>
            <Text variant="h1">Music Preferences</Text>
            <Text variant="bodyMd" color="onSurfaceVariant">
              Refine your auditory landscape. Adjusting these parameters
              directly influences your personalized HiMu streams.
            </Text>
          </View>
        </View>

        {/* Genre Affinity */}
        <PrefSection
          title="Genre Affinity"
          icon={<AudioLines size={20} color={theme.colors.primaryContainer} />}
        >
          <View style={styles.chipWrap}>
            {GENRES.map((g) => (
              <Chip
                key={g}
                label={g}
                selected={prefs.genres.includes(g)}
                disabled={!ready}
                onPress={() => toggleGenre(g)}
              />
            ))}
          </View>
        </PrefSection>

        {/* Vibe Mapping */}
        <PrefSection
          title="Vibe Mapping"
          icon={
            <SlidersHorizontal
              size={20}
              color={theme.colors.primaryContainer}
            />
          }
        >
          <VibeSlider
            leftLabel="Organic / Acoustic"
            rightLabel="Synthetic / Electronic"
            value={prefs.vibeMapping.organicElectronic}
            disabled={!ready}
            onCommit={setVibe("organicElectronic")}
          />
          <VibeSlider
            leftLabel="Melancholic"
            rightLabel="Euphoric"
            value={prefs.vibeMapping.melancholicEuphoric}
            disabled={!ready}
            onCommit={setVibe("melancholicEuphoric")}
          />
        </PrefSection>

        {/* AI Interaction Frequency */}
        <PrefSection
          title="AI Interaction Frequency"
          subtitle="How often the AI curates mid-session transitions."
        >
          <Segmented
            options={AI_OPTIONS}
            value={prefs.aiFrequency}
            disabled={!ready}
            onChange={(v) => update({ ...prefs, aiFrequency: v })}
          />
        </PrefSection>

        {/* Discovery Depth */}
        <PrefSection
          title="Discovery Depth"
          subtitle="Prioritize unknown artists over familiar catalogs."
        >
          <View style={styles.row}>
            <Text variant="bodyMd" color="onSurfaceVariant">
              Surface new artists
            </Text>
            <Toggle
              value={prefs.discoveryDepth}
              disabled={!ready}
              onValueChange={(v) => update({ ...prefs, discoveryDepth: v })}
              accessibilityLabel="Discovery Depth"
            />
          </View>
        </PrefSection>

        {/* Excluded Moods */}
        <PrefSection
          title="Excluded Moods"
          icon={<Ban size={20} color={theme.colors.error} />}
        >
          <View style={styles.chipWrap}>
            {prefs.excludedMoods.map((m) => (
              <Animated.View
                key={m}
                entering={FadeIn.duration(160)}
                exiting={FadeOut.duration(120)}
                layout={LinearTransition}
              >
                <Chip
                  label={m}
                  onRemove={() => removeMood(m)}
                  disabled={!ready}
                />
              </Animated.View>
            ))}
            <Animated.View layout={LinearTransition}>
              <Chip
                label="Add Exclusion"
                add
                disabled={!ready || availableMoods.length === 0}
                onPress={addMood}
              />
            </Animated.View>
          </View>
        </PrefSection>
      </ScrollView>
    </View>
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
  header: {
    gap: theme.spacing.stackMd,
  },
  headerText: {
    gap: theme.spacing.stackXs,
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
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.stackSm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.gutter,
  },
  pressed: {
    opacity: 0.6,
  },
}));
