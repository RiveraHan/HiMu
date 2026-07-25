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
import { catalogGroupLabel, catalogLabel } from "@/src/i18n/catalog-labels";
import { useLocale } from "@/src/i18n/use-locale";
import {
  DEFAULT_MUSIC_PREFERENCES,
  GENRE_GROUPS,
  MOOD_GROUPS,
} from "@/src/types/music-preferences";
import { AudioLines, Ban, SlidersHorizontal } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

export default function MusicPreferencesScreen() {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLocale();
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
        kicker={t("dj.preferences.kicker")}
        title={t("dj.preferences.title")}
        subtitle={t("dj.preferences.subtitle")}
      />

      {/* Genre Affinity */}
      <PrefSection
        title={t("dj.preferences.genreAffinity")}
        icon={<AudioLines size={20} color={theme.colors.primaryContainer} />}
      >
        <GroupedChipPicker
          groups={GENRE_GROUPS}
          selected={prefs.genres}
          onToggle={toggleGenre}
          getGroupLabel={(value) => catalogGroupLabel(value, resolvedLanguage)}
          getItemLabel={(value) => catalogLabel(value, resolvedLanguage)}
          disabled={!ready}
        />
      </PrefSection>

      {/* Vibe Mapping */}
      <PrefSection
        title={t("dj.preferences.vibeMapping")}
        icon={
          <SlidersHorizontal size={20} color={theme.colors.primaryContainer} />
        }
      >
        <VibeSlider
          leftLabel={t("dj.preferences.organicAcoustic")}
          rightLabel={t("dj.preferences.syntheticElectronic")}
          value={prefs.vibeMapping.organicElectronic}
          disabled={!ready}
          onCommit={setVibe("organicElectronic")}
        />
        <VibeSlider
          leftLabel={t("dj.preferences.melancholic")}
          rightLabel={t("dj.preferences.euphoric")}
          value={prefs.vibeMapping.melancholicEuphoric}
          disabled={!ready}
          onCommit={setVibe("melancholicEuphoric")}
        />
      </PrefSection>

      {/* Excluded Moods */}
      <PrefSection
        title={t("dj.preferences.excludedMoods")}
        subtitle={t("dj.preferences.excludedMoodsSubtitle")}
        icon={<Ban size={20} color={theme.colors.error} />}
      >
        <GroupedChipPicker
          groups={MOOD_GROUPS}
          selected={prefs.excludedMoods}
          onToggle={toggleExcluded}
          getGroupLabel={(value) => catalogGroupLabel(value, resolvedLanguage)}
          getItemLabel={(value) => catalogLabel(value, resolvedLanguage)}
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
