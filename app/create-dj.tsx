import {
  Button,
  canSubmitDjTraits,
  DjTraitsForm,
  ResponsiveFormShell,
  type DjTraits,
} from "@/src/components";
import { VisibilityField } from "@/src/components/content/VisibilityField";
import {
  DjIdentityDraftStep,
  type DjIdentityDraftValue,
} from "@/src/components/dj/DjIdentityDraftStep";
import { useCreateDJ } from "@/src/hooks/use-create-dj";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { PrefSection } from "@/src/components/preferences/PrefSection";
import { Text } from "@/src/components/Text";
import {
  DEFAULT_VISIBILITY,
  visibilityToIsPublic,
  type Visibility,
} from "@/src/types/content-visibility";
import { router } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";
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
  const traitsReady = canSubmitDjTraits(traits, false);
  const visibilityDescription = visibility === "public"
    ? t("dj.visibility.publicDescription")
    : t("dj.visibility.privateDescription");
  const steps = [
    {
      id: "traits",
      label: t("dj.traits.genres"),
      description: t("dj.traits.vibeSubtitle"),
    },
    {
      id: "identity",
      label: t("dj.identity.title"),
      description: t("dj.identity.subtitle"),
    },
    {
      id: "review",
      label: t("dj.visibility.title"),
      description: visibilityDescription,
    },
  ] as const;
  const activeStep = !traitsReady
    ? "traits"
    : !identity.confirmed
      ? "identity"
      : "review";

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
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ResponsiveFormShell
        title={t("dj.create.title")}
        description={t("dj.create.subtitle")}
        steps={steps}
        activeStep={activeStep}
        form={
          <View style={styles.editor}>
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
          </View>
        }
        review={
          <View testID="create-dj-review" style={styles.review}>
            <PrefSection
              title={t("dj.identity.title")}
              subtitle={identity.confirmed
                ? t("dj.identity.confirmed")
                : t("dj.identity.draft")}
            >
              <Text variant="h2">{displayName}</Text>
              {identity.identityConcept.trim() ? (
                <Text color="onSurfaceVariant">
                  {identity.identityConcept.trim()}
                </Text>
              ) : null}
            </PrefSection>
            <PrefSection
              title={t("dj.traits.genres")}
              subtitle={traits.genres.join(", ") || t("dj.traits.pickRange", { max: 3 })}
            >
              <SummaryRow label={t("dj.traits.moods")} value={traits.moods.join(", ")} />
              <SummaryRow label={t("dj.traits.energy")} value={`${traits.energy}/10`} />
              <SummaryRow
                label={t("dj.traits.sound")}
                value={t(`dj.traits.${traits.mode}`)}
              />
              {traits.vibe.trim() ? (
                <SummaryRow label={t("dj.traits.vibe")} value={traits.vibe.trim()} />
              ) : null}
            </PrefSection>
            <View testID="create-dj-visibility-summary">
              <PrefSection
                title={t("dj.visibility.title")}
                subtitle={visibilityDescription}
              >
                <Text>{t(`dj.visibility.${visibility}`)}</Text>
              </PrefSection>
            </View>
          </View>
        }
        footer={
          <View style={[styles.footer, { paddingBottom }]}>
            <Button
              label={t("dj.create.submit")}
              loadingLabel={t("dj.create.loading", { name: displayName })}
              loading={isPending}
              disabled={!traitsReady || !identity.confirmed}
              onPress={onSubmit}
              leftIcon={
                !isPending && (
                  <Sparkles size={20} color={theme.colors.onPrimaryContainer} />
                )
              }
            />
          </View>
        }
      />
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text color="outline">{label}</Text>
      <Text>{value || "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  editor: {
    gap: theme.spacing.stackLg,
  },
  review: {
    gap: theme.spacing.stackLg,
  },
  summaryRow: {
    gap: theme.spacing.stackXs,
  },
  footer: {
    width: "100%",
  },
}));
