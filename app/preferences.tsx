import {
  AtmosphereChoice,
  MusicPreferenceSkeletons,
  PrefSection,
  ProgressiveCatalogPicker,
  ScreenHeader,
  ScreenScrollView,
  StateNotice,
  Text,
} from "@/src/components";
import { useMusicPreferencesController } from "@/src/hooks/use-music-preferences-controller";
import { catalogGroupLabel, catalogLabel } from "@/src/i18n/catalog-labels";
import { useLocale } from "@/src/i18n/use-locale";
import {
  GENRE_GROUPS,
  MOOD_GROUPS,
  type Atmosphere,
} from "@/src/types/music-preferences";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

function changedValue(
  previous: readonly string[],
  next: readonly string[],
): string | null {
  return previous.find((value) => !next.includes(value))
    ?? next.find((value) => !previous.includes(value))
    ?? null;
}

export default function MusicPreferencesScreen() {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLocale();
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const { theme } = useUnistyles();
  const controller = useMusicPreferencesController();
  const { prefs } = controller;

  const updateGenres = useCallback((next: string[]) => {
    const value = changedValue(prefs.genres, next);
    return value ? controller.toggleGenre(value) : { accepted: true as const };
  }, [controller, prefs.genres]);
  const updateExcludedMoods = useCallback((next: string[]) => {
    const value = changedValue(prefs.excludedMoods, next);
    return value ? controller.toggleExcludedMood(value) : { accepted: true as const };
  }, [controller, prefs.excludedMoods]);

  const status = controller.saveStatus === "saving"
    ? t("dj.preferences.saving")
    : controller.saveStatus === "saved"
      ? t("dj.preferences.saved")
      : "";

  return (
    <ScreenScrollView
      testID="preferences-settings-scroll"
      style={styles.root}
      canvasVariant="readable"
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

      {controller.offlineWithoutData ? (
        <StateNotice
          kind="offline"
          title={t("common.errors.offline")}
          message={t("common.errors.reconnect")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void controller.refetch()}
        />
      ) : controller.initialLoading ? (
        <MusicPreferenceSkeletons />
      ) : controller.blockingError ? (
        <StateNotice
          kind="error"
          title={t("common.errors.generic")}
          actionLabel={t("common.actions.retry")}
          onAction={() => void controller.refetch()}
        />
      ) : (
        <View style={styles.sections}>
          <PrefSection title={t("dj.preferences.favoriteGenres")}>
            <ProgressiveCatalogPicker
              title={t("dj.preferences.favoriteGenres")}
              chooseLabel={t("dj.preferences.chooseGenres")}
              editLabel={t("dj.preferences.editGenres")}
              emptyDescription={t("dj.preferences.emptyGenres")}
              groups={GENRE_GROUPS}
              selected={prefs.genres}
              min={0}
              max={5}
              getGroupLabel={(value) => catalogGroupLabel(value, resolvedLanguage)}
              getItemLabel={(value) => catalogLabel(value, resolvedLanguage)}
              onChange={updateGenres}
              disabled={!controller.ready}
            />
          </PrefSection>

          <PrefSection title={t("dj.preferences.usualAtmosphere")}>
            <AtmosphereChoice
              value={prefs.atmosphere}
              options={([
                ["calm", "calm", "calmDescription"],
                ["balanced", "balanced", "balancedDescription"],
                ["intense", "intense", "intenseDescription"],
              ] as const).map(([value, label, description]) => ({
                value: value as Atmosphere,
                label: t(`dj.preferences.${label}`),
                description: t(`dj.preferences.${description}`),
              }))}
              accessibilityLabel={t("dj.preferences.usualAtmosphere")}
              onChange={controller.setAtmosphere}
              disabled={!controller.ready}
            />
          </PrefSection>

          <PrefSection title={t("dj.preferences.moodsToAvoid")}>
            <ProgressiveCatalogPicker
              title={t("dj.preferences.moodsToAvoid")}
              chooseLabel={t("dj.preferences.chooseMoods")}
              editLabel={t("dj.preferences.editMoods")}
              emptyDescription={t("dj.preferences.emptyMoods")}
              groups={MOOD_GROUPS}
              selected={prefs.excludedMoods}
              min={0}
              max={3}
              getGroupLabel={(value) => catalogGroupLabel(value, resolvedLanguage)}
              getItemLabel={(value) => catalogLabel(value, resolvedLanguage)}
              onChange={updateExcludedMoods}
              disabled={!controller.ready}
            />
          </PrefSection>

          {controller.showCachedNotice ? (
            <StateNotice
              compact
              kind={controller.cachedNoticeKind}
              title={t(controller.cachedNoticeKind === "error"
                ? "common.errors.generic"
                : "common.errors.offline")}
              actionLabel={t("common.actions.retry")}
              onAction={() => void controller.refetch()}
            />
          ) : null}
          {controller.nudgeCompletionError ? (
            <StateNotice
              compact
              kind="error"
              title={t("dj.preferences.completionFailed")}
              actionLabel={t("common.actions.retry")}
              onAction={controller.retryNudgeCompletion}
            />
          ) : null}
          <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
        </View>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: theme.spacing.pageMargin, gap: theme.spacing.stackLg },
  sections: { gap: theme.spacing.stackLg },
  status: { minHeight: 20 },
}));
