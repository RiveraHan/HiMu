import { GlassInput } from "@/src/components/GlassInput";
import { Chip } from "@/src/components/preferences/Chip";
import { PrefSection } from "@/src/components/preferences/PrefSection";
import { Segmented } from "@/src/components/preferences/Segmented";
import { VibeSlider } from "@/src/components/preferences/VibeSlider";
import { DJ_MOODS, GENRES } from "@/src/types/music-preferences";
import { View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

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
      <PrefSection title="Identity" subtitle="What should we call it?">
        <GlassInput
          placeholder="e.g. Lumen"
          value={values.name}
          onChangeText={(name) => onChange({ name })}
          maxLength={24}
          autoCapitalize="words"
          editable={!disabled}
        />
      </PrefSection>

      {/* Genres */}
      <PrefSection title="Genres" subtitle={`Pick 1-${MAX_PICKS}`}>
        <View style={styles.chipWrap}>
          {GENRES.map((g) => (
            <Chip
              key={g}
              label={g}
              selected={values.genres.includes(g)}
              onPress={() => toggleGenre(g)}
              disabled={disabled}
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
              selected={values.moods.includes(m)}
              onPress={() => toggleMood(m)}
              disabled={disabled}
            />
          ))}
        </View>
      </PrefSection>

      {/* Energy */}
      <PrefSection title="Energy" subtitle={`${values.energy}/10`}>
        <VibeSlider
          leftLabel="CALM"
          rightLabel="INTENSE"
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
        title="Sound"
        subtitle="Vocal DJs can sing your own lyrics"
      >
        <Segmented<"instrumental" | "vocal">
          options={[
            { label: "INSTRUMENTAL", value: "instrumental" },
            { label: "VOCAL", value: "vocal" },
          ]}
          value={values.mode}
          onChange={(mode) => onChange({ mode })}
          disabled={disabled}
        />
      </PrefSection>

      {/* Vibe */}
      <PrefSection title="Vibe" subtitle="Optional - a hint of personality">
        <GlassInput
          placeholder="e.g. late-night rooftop textures"
          value={values.vibe}
          onChangeText={(vibe) => onChange({ vibe })}
          maxLength={140}
          editable={!disabled}
        />
      </PrefSection>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.stackSm,
  },
}));
