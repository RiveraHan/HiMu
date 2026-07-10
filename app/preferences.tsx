import {
  GroupedChipPicker,
  PrefSection,
  ScreenHeader,
  ScreenScrollView,
  VibeSlider,
} from "@/src/components";
import {
  useMusicPreferences,
  useUpdateMusicPreferences,
} from "@/src/hooks/use-music-preferences";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import {
  DEFAULT_MUSIC_PREFERENCES,
  GENRE_GROUPS,
  MOOD_GROUPS,
} from "@/src/types/music-preferences";
import { AudioLines, Ban, SlidersHorizontal } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export default function MusicPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const { theme } = useUnistyles();
  const { data } = useMusicPreferences();
  const { mutate: update } = useUpdateMusicPreferences();

  const prefs = data ?? DEFAULT_MUSIC_PREFERENCES;
  const ready = !!data;

  const toggleGenre = (genre: string) => {
    const has = prefs.genres.includes(genre);
    update({
      ...prefs,
      genres: has
        ? prefs.genres.filter((g) => g !== genre)
        : [...prefs.genres, genre],
    });
  };

  const toggleExcluded = (mood: string) => {
    const has = prefs.excludedMoods.includes(mood);
    update({
      ...prefs,
      excludedMoods: has
        ? prefs.excludedMoods.filter((m) => m !== mood)
        : [...prefs.excludedMoods, mood],
    });
  };

  const setVibe =
    (key: "organicElectronic" | "melancholicEuphoric") => (v: number) =>
      update({ ...prefs, vibeMapping: { ...prefs.vibeMapping, [key]: v } });

  return (
    <ScreenScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
      ]}
    >
      <ScreenHeader
        kicker="TASTE PROFILE"
        title="Music Preferences"
        subtitle="Shapes your AI Mixes and Focus queue - and nudges what your DJs generate."
      />

      {/* Genre Affinity */}
      <PrefSection
        title="Genre Affinity"
        icon={<AudioLines size={20} color={theme.colors.primaryContainer} />}
      >
        <GroupedChipPicker
          groups={GENRE_GROUPS}
          selected={prefs.genres}
          onToggle={toggleGenre}
          disabled={!ready}
        />
      </PrefSection>

      {/* Vibe Mapping */}
      <PrefSection
        title="Vibe Mapping"
        icon={
          <SlidersHorizontal size={20} color={theme.colors.primaryContainer} />
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

      {/* Excluded Moods */}
      <PrefSection
        title="Excluded Moods"
        subtitle="Never picked for your auto queues - you can still play or generate anything you ask for."
        icon={<Ban size={20} color={theme.colors.error} />}
      >
        <GroupedChipPicker
          groups={MOOD_GROUPS}
          selected={prefs.excludedMoods}
          onToggle={toggleExcluded}
          disabled={!ready}
        />
      </PrefSection>
    </ScreenScrollView>
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
}));
