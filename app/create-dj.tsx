import {
  Button,
  canSubmitDjTraits,
  DjTraitsForm,
  ScreenHeader,
  type DjTraits,
} from "@/src/components";
import { VisibilityField } from "@/src/components/content/VisibilityField";
import {
  DjIdentityDraftStep,
  type DjIdentityDraftValue,
} from "@/src/components/dj/DjIdentityDraftStep";
import { useCreateDJ } from "@/src/hooks/use-create-dj";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import {
  DEFAULT_VISIBILITY,
  visibilityToIsPublic,
  type Visibility,
} from "@/src/types/content-visibility";
import { router } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useTranslation } from "react-i18next";

export default function CreateDJScreen() {
  const { t } = useTranslation();
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
  const [visibility, setVisibility] = useState<Visibility>(DEFAULT_VISIBILITY);
  const [identity, setIdentity] = useState<DjIdentityDraftValue>({
    name: "",
    identityConcept: "",
    provenance: "custom",
    confirmed: false,
  });

  const { mutate: createDJ, isPending } = useCreateDJ();

  const patch = (p: Partial<DjTraits>) => setTraits((t) => ({ ...t, ...p }));
  const displayName = identity.name.trim() || t("dj.create.defaultName");

  function onSubmit() {
    if (!identity.confirmed) return;
    createDJ(
      {
        name: identity.name.trim(),
        identityConcept: identity.identityConcept.trim(),
        genres: traits.genres,
        moods: traits.moods,
        energy: traits.energy,
        isInstrumental: traits.mode === "instrumental",
        vibe: traits.vibe.trim() || undefined,
        isPublic: visibilityToIsPublic(visibility),
      },
      {
        onSuccess: ({ djId }) => router.replace(`/dj/${djId}`),
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
          title={t("dj.create.title")}
          subtitle={t("dj.create.subtitle")}
        />

        <DjTraitsForm
          values={traits}
          onChange={patch}
          disabled={isPending}
          showName={false}
        />
        <DjIdentityDraftStep
          traits={{
            genres: traits.genres,
            moods: traits.moods,
            energy: traits.energy,
            isInstrumental: traits.mode === "instrumental",
            vibe: traits.vibe.trim() || null,
          }}
          value={identity}
          onChange={setIdentity}
          disabled={isPending}
        />
        <VisibilityField
          value={visibility}
          onChange={setVisibility}
          disabled={isPending}
        />

        <Button
          label={t("dj.create.submit")}
          loadingLabel={t("dj.create.loading", { name: displayName })}
          loading={isPending}
          disabled={!canSubmitDjTraits(traits, false) || !identity.confirmed}
          onPress={onSubmit}
          leftIcon={
            !isPending && (
              <Sparkles size={20} color={theme.colors.onPrimaryContainer} />
            )
          }
        />
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
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: theme.spacing.pageMargin,
    gap: theme.spacing.stackLg,
  },
}));
