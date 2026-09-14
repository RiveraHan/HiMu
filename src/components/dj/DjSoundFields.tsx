import { GlassInput } from "@/src/components/GlassInput";
import { ProgressiveCatalogPicker } from "@/src/components/preferences/ProgressiveCatalogPicker";
import { PrefSection } from "@/src/components/preferences/PrefSection";
import { Segmented } from "@/src/components/preferences/Segmented";
import { catalogGroupLabel, catalogLabel } from "@/src/i18n/catalog-labels";
import { useLocale } from "@/src/i18n/use-locale";
import { GENRE_GROUPS, MOOD_GROUPS } from "@/src/types/music-preferences";
import { useTranslation } from "react-i18next";

import { DjIntensityChoice } from "./DjIntensityChoice";
import type { DjIntensityChoice as DjIntensityChoiceValue, DjSoundDraft } from "./create-dj-wizard-state";

const MAX_PICKS = 3;

export type DjSoundFieldsProps = Readonly<{
  genres: string[];
  moods: string[];
  intensity: DjIntensityChoiceValue;
  mode: "instrumental" | "vocal";
  vibe: string;
  disabled?: boolean;
  onChange(patch: Partial<DjSoundDraft>): void;
}>;

export function DjSoundFields({
  genres,
  moods,
  intensity,
  mode,
  vibe,
  disabled = false,
  onChange,
}: DjSoundFieldsProps) {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLocale();

  return (
    <>
      <PrefSection title={t("dj.traits.genres")} subtitle={t("dj.traits.pickRange", { max: MAX_PICKS })}>
        <ProgressiveCatalogPicker
          title={t("dj.traits.genres")}
          groups={GENRE_GROUPS}
          selected={genres}
          min={1}
          max={MAX_PICKS}
          disabled={disabled}
          getGroupLabel={(value) => catalogGroupLabel(value, resolvedLanguage)}
          getItemLabel={(value) => catalogLabel(value, resolvedLanguage)}
          onChange={(next) => onChange({ genres: next })}
        />
      </PrefSection>

      <PrefSection title={t("dj.traits.moods")} subtitle={t("dj.traits.pickRange", { max: MAX_PICKS })}>
        <ProgressiveCatalogPicker
          title={t("dj.traits.moods")}
          groups={MOOD_GROUPS}
          selected={moods}
          min={1}
          max={MAX_PICKS}
          disabled={disabled}
          getGroupLabel={(value) => catalogGroupLabel(value, resolvedLanguage)}
          getItemLabel={(value) => catalogLabel(value, resolvedLanguage)}
          onChange={(next) => onChange({ moods: next })}
        />
      </PrefSection>

      <PrefSection title={t("dj.traits.intensity")} subtitle={t("dj.traits.intensitySubtitle")}>
        <DjIntensityChoice
          value={intensity}
          accessibilityLabel={t("dj.traits.intensity")}
          disabled={disabled}
          onChange={(next) => onChange({ intensity: next })}
          options={[
            { value: "calm", label: t("dj.traits.calm"), description: t("dj.traits.calmDescription") },
            { value: "balanced", label: t("dj.traits.balanced"), description: t("dj.traits.balancedDescription") },
            { value: "intense", label: t("dj.traits.intense"), description: t("dj.traits.intenseDescription") },
          ]}
        />
      </PrefSection>

      <PrefSection title={t("dj.traits.sound")} subtitle={t("dj.traits.soundSubtitle")}>
        <Segmented<"instrumental" | "vocal">
          accessibilityLabel={t("dj.traits.sound")}
          options={[
            { label: t("dj.traits.instrumental"), value: "instrumental" },
            { label: t("dj.traits.vocal"), value: "vocal" },
          ]}
          value={mode}
          onChange={(next) => onChange({ mode: next })}
          disabled={disabled}
        />
      </PrefSection>

      <PrefSection title={t("dj.traits.vibe")} subtitle={t("dj.traits.vibeSubtitle")}>
        <GlassInput
          placeholder={t("dj.traits.vibePlaceholder")}
          value={vibe}
          onChangeText={(next) => onChange({ vibe: next })}
          maxLength={140}
          editable={!disabled}
        />
      </PrefSection>
    </>
  );
}
