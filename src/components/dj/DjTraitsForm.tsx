import { GlassInput } from "@/src/components/GlassInput";
import { PrefSection } from "@/src/components/preferences/PrefSection";
import { useTranslation } from "react-i18next";
import { DjSoundFields } from "./DjSoundFields";
import { applyExplicitIntensity, energyToIntensity } from "./create-dj-wizard-state";

export type DjTraits = {
  name: string;
  genres: string[];
  moods: string[];
  energy: number;
  mode: "instrumental" | "vocal";
  vibe: string;
};

export const canSubmitDjTraits = (t: DjTraits, requireName = true) =>
  (!requireName || t.name.trim().length >= 2) &&
  t.genres.length > 0 &&
  t.moods.length > 0;

export type DjTraitsFormProps = {
  values: DjTraits;
  onChange: (patch: Partial<DjTraits>) => void;
  disabled?: boolean;
  showName?: boolean;
};

// The six wizard sections shared by Create DJ and Train your DJ.
export function DjTraitsForm({
  values,
  onChange,
  disabled = false,
  showName = true,
}: DjTraitsFormProps) {
  const { t } = useTranslation();

  return (
    <>
      {showName ? (
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
      ) : null}

      <DjSoundFields
        genres={values.genres}
        moods={values.moods}
        intensity={energyToIntensity(values.energy)}
        mode={values.mode}
        vibe={values.vibe}
        disabled={disabled}
        onChange={({ intensity, ...patch }) => onChange({
          ...patch,
          ...(intensity === undefined
            ? {}
            : { energy: applyExplicitIntensity(values.energy, intensity) }),
        })}
      />
    </>
  );
}
