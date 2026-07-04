import { getEdgeErrorCode } from "@/src/api/edge-errors";
import {
  Button,
  canSubmitDjTraits,
  DjBirthOverlay,
  DjTraitsForm,
  ScreenHeader,
  type DjTraits,
} from "@/src/components";
import { useCreateDJ } from "@/src/hooks/use-create-dj";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { router } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

export default function CreateDJScreen() {
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const { theme } = useUnistyles();

  const [traits, setTraits] = useState<DjTraits>({
    name: "",
    genres: [],
    moods: [],
    energy: 5,
    mode: "instrumental",
    vibe: "",
  });

  const { mutate: createDJ, isPending } = useCreateDJ();

  const patch = (p: Partial<DjTraits>) => setTraits((t) => ({ ...t, ...p }));
  const displayName = traits.name.trim() || "your DJ";

  function onSubmit() {
    createDJ(
      {
        name: traits.name.trim(),
        genres: traits.genres,
        moods: traits.moods,
        energy: traits.energy,
        isInstrumental: traits.mode === "instrumental",
        vibe: traits.vibe.trim() || undefined,
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
          { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          title="Create your DJ"
          subtitle="Shape a companion that generates music just for you."
          disabled={isPending}
        />

        <DjTraitsForm values={traits} onChange={patch} disabled={isPending} />

        <Button
          label="Bring my DJ to life"
          loadingLabel={`Giving life to ${displayName}…`}
          loading={isPending}
          disabled={!canSubmitDjTraits(traits)}
          onPress={onSubmit}
          leftIcon={
            !isPending && (
              <Sparkles size={20} color={theme.colors.onPrimaryContainer} />
            )
          }
        />
      </ScrollView>

      {isPending && <DjBirthOverlay name={displayName} />}
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
}));
