import { GlassInput } from "@/src/components/GlassInput";
import { GroupedChipPicker } from "@/src/components/preferences/GroupedChipPicker";
import { PrefSection } from "@/src/components/preferences/PrefSection";
import { Segmented } from "@/src/components/preferences/Segmented";
import { VibeSlider } from "@/src/components/preferences/VibeSlider";
import { catalogGroupLabel, catalogLabel } from "@/src/i18n/catalog-labels";
import { useLocale } from "@/src/i18n/use-locale";
import { GENRE_GROUPS, MOOD_GROUPS } from "@/src/types/music-preferences";
import { useTranslation } from "react-i18next";

const MAX_PICKS = 3;

export type DjTraits = {
  name: string;
  genres: string[];
  moods: string[];
  energy: number;
  mode: "instrumental" | "vocal";
  vibe: string;
};

export const canSubmitDjTraits = (t: DjTraits) =>
  t.name.trim().length >= 2 && t.genres.length > 0 && t.moods.length > 0;

type Props = {
  values: DjTraits;
  onChange: (patch: Partial<DjTraits>) => void;
  disabled?: boolean;
};

// The six wizard sections shared by Create DJ and Train your DJ.
export function DjTraitsForm({ values, onChange, disabled = false }: Props) {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLocale();
  const togglePick = (key: "genres" | "moods") => (value: string) => {
    const list = values[key];
    const next = list.includes(value)
      ? list.filter((v) => v !== value)
      : list.length >= MAX_PICKS
        ? list
        : [...list, value];
    onChange(key === "genres" ? { genres: next } : { moods: next });
  };

  const toggleGenre = togglePick("genres");
  const toggleMood = togglePick("moods");

  return (
    <>
      {/* Identity */}
      <PrefSection
        title={t("dj.traits.identity")}
        subtitle={t("dj.traits.identitySubtitle")}
      >
        <GlassInput
          placeholder={t("dj.traits.namePlaceholder")}
          value={values.name}
          onChangeText={(name) => onChange({ name })}
          maxLength={24}
          autoCapitalize="words"
          editable={!disabled}
        />
      </PrefSection>

      {/* Genres */}
      <PrefSection
        title={t("dj.traits.genres")}
        subtitle={t("dj.traits.pickRange", { max: MAX_PICKS })}
      >
        <GroupedChipPicker
          groups={GENRE_GROUPS}
          selected={values.genres}
          onToggle={toggleGenre}
          getGroupLabel={(value) => catalogGroupLabel(value, resolvedLanguage)}
          getItemLabel={(value) => catalogLabel(value, resolvedLanguage)}
          disabled={disabled}
        />
      </PrefSection>

      {/* Moods */}
      <PrefSection
        title={t("dj.traits.moods")}
        subtitle={t("dj.traits.pickRange", { max: MAX_PICKS })}
      >
        <GroupedChipPicker
          groups={MOOD_GROUPS}
          selected={values.moods}
          onToggle={toggleMood}
          getGroupLabel={(value) => catalogGroupLabel(value, resolvedLanguage)}
          getItemLabel={(value) => catalogLabel(value, resolvedLanguage)}
          disabled={disabled}
        />
      </PrefSection>

      {/* Energy */}
      <PrefSection
        title={t("dj.traits.energy")}
        subtitle={`${values.energy}/10`}
      >
        <VibeSlider
          leftLabel={t("dj.traits.calm")}
          rightLabel={t("dj.traits.intense")}
          value={values.energy}
          onCommit={(energy) => onChange({ energy })}
          minimumValue={1}
          maximumValue={10}
          step={1}
          disabled={disabled}
        />
      </PrefSection>

      {/* Sound */}
      <PrefSection
        title={t("dj.traits.sound")}
        subtitle={t("dj.traits.soundSubtitle")}
      >
        <Segmented<"instrumental" | "vocal">
          options={[
            { label: t("dj.traits.instrumental"), value: "instrumental" },
            { label: t("dj.traits.vocal"), value: "vocal" },
          ]}
          value={values.mode}
          onChange={(mode) => onChange({ mode })}
          disabled={disabled}
        />
      </PrefSection>

      {/* Vibe */}
      <PrefSection
        title={t("dj.traits.vibe")}
        subtitle={t("dj.traits.vibeSubtitle")}
      >
        <GlassInput
          placeholder={t("dj.traits.vibePlaceholder")}
          value={values.vibe}
          onChangeText={(vibe) => onChange({ vibe })}
          maxLength={140}
          editable={!disabled}
        />
      </PrefSection>
    </>
  );
}
