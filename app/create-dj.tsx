import { getEdgeErrorCode } from "@/src/api/edge-errors";
import {
  Button,
  Chip,
  GlassInput,
  PrefSection,
  Segmented,
  Text,
  VibeSlider,
} from "@/src/components";
import { useCreateDJ } from "@/src/hooks/use-create-dj";
import { DJ_MOODS, GENRES } from "@/src/types/music-preferences";
import { router } from "expo-router";
import { ChevronLeft, Sparkles } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

const MAX_PICKS = 3;

export default function CreateDJScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();

  const [name, setName] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [energy, setEnergy] = useState(5);
  const [mode, setMode] = useState<"instrumental" | "vocal">("instrumental");
  const [vibe, setVibe] = useState("");

  const { mutate: createDJ, isPending } = useCreateDJ();

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

  function onSubmit() {
    createDJ(
      {
        name: name.trim(),
        genres,
        moods,
        energy,
        isInstrumental: mode === "instrumental",
        vibe: vibe.trim() || undefined,
      },
      {
        onSuccess: ({ djId }) => router.replace(`/dj/${djId}`),
        onError: async (e) => {
          const code = await getEdgeErrorCode(e);
          Alert.alert(
            "Couldn't create your DJ",
            code === "dj_quota_reached"
              ? "You already have 2 DJs. Delete one to create another."
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
          <Text variant="h1">Create your DJ</Text>
          <Text variant="bodyMd" color="onSurfaceVariant">
            Shape a companion that generates music just for you.
          </Text>
        </View>

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
          subtitle="Vocal DJs can sing your own lyrics later"
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
            placeholder="e.g late-night rooftop textures"
            value={vibe}
            onChangeText={setVibe}
            maxLength={140}
            editable={!isPending}
          />
        </PrefSection>

        <Button
          label="Bring my DJ to life"
          loadingLabel={`Giving life to ${name.trim() || "your DJ"}…`}
          loading={isPending}
          disabled={!canSubmit}
          onPress={onSubmit}
          leftIcon={
            !isPending && (
              <Sparkles size={20} color={theme.colors.onPrimaryContainer} />
            )
          }
        />
        {isPending && (
          <Text variant="bodyMd" color="onSurfaceVariant" style={styles.wait}>
            Composing its portrait… this takes a few seconds.
          </Text>
        )}
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
  wait: {
    textAlign: "center",
  },
  pressed: {
    opacity: 0.6,
  },
}));
