import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/src/components/Button";
import { Text } from "@/src/components/Text";
import { VisibilityField } from "@/src/components/content/VisibilityField";
import type {
  CreateDjStep,
  DjSoundDraft,
} from "@/src/components/dj/create-dj-wizard-state";
import type { DjIdentityDraftValue } from "@/src/components/dj/DjIdentityDraftStep";
import { PrefSection } from "@/src/components/preferences/PrefSection";
import { catalogLabel } from "@/src/i18n/catalog-labels";
import { useLocale } from "@/src/i18n/use-locale";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import type { Visibility } from "@/src/types/content-visibility";

export type CreateDjReviewProps = Readonly<{
  sound: DjSoundDraft;
  identity: DjIdentityDraftValue;
  visibility: Visibility;
  readOnly?: boolean;
  onVisibilityChange(visibility: Visibility): void;
  onEdit(step: CreateDjStep): void;
}>;

export function CreateDjReview({
  sound,
  identity,
  visibility,
  readOnly = false,
  onVisibilityChange,
  onEdit,
}: CreateDjReviewProps) {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLocale();
  const visibilityDescription = visibility === "public"
    ? t("dj.visibility.publicDescription")
    : t("dj.visibility.privateDescription");

  return (
    <View testID="create-dj-review" style={styles.root}>
      <Text accessibilityRole="header" variant="h2">{t("dj.create.review.title")}</Text>

      <PrefSection title={t("dj.create.review.identityTitle")}>
        <View style={styles.sectionHeading}>
          <Text variant="h2">{identity.name.trim()}</Text>
          {!readOnly ? (
            <Button
              variant="ghost"
              label={t("dj.create.review.editIdentity")}
              onPress={() => onEdit("identity")}
            />
          ) : null}
        </View>
        <Text color="onSurfaceVariant">{identity.identityConcept.trim()}</Text>
      </PrefSection>

      <PrefSection title={t("dj.create.review.soundTitle")}>
        <View style={styles.sectionHeading}>
          <Text color="outline">{t("dj.traits.genres")}</Text>
          {!readOnly ? (
            <Button
              variant="ghost"
              label={t("dj.create.review.editSound")}
              onPress={() => onEdit("sound")}
            />
          ) : null}
        </View>
        <SummaryRow
          label={t("dj.traits.genres")}
          value={sound.genres.map((value) => catalogLabel(value, resolvedLanguage)).join(", ")}
        />
        <SummaryRow
          label={t("dj.traits.moods")}
          value={sound.moods.map((value) => catalogLabel(value, resolvedLanguage)).join(", ")}
        />
        <SummaryRow
          label={t("dj.create.review.intensity")}
          value={t(`dj.create.review.intensityValues.${sound.intensity}`)}
        />
        <SummaryRow
          label={t("dj.create.review.soundMode")}
          value={t(`dj.create.review.soundModes.${sound.mode}`)}
        />
        {sound.vibe.trim() ? (
          <SummaryRow label={t("dj.create.review.personalDetail")} value={sound.vibe.trim()} />
        ) : null}
      </PrefSection>

      {readOnly ? (
        <PrefSection title={t("dj.visibility.title")} subtitle={visibilityDescription}>
          <Text>{t(`dj.visibility.${visibility}`)}</Text>
        </PrefSection>
      ) : (
        <VisibilityField value={visibility} onChange={onVisibilityChange} />
      )}
    </View>
  );
}

function SummaryRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <View style={styles.row}>
      <Text color="outline">{label}</Text>
      <Text>{value || "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { gap: theme.spacing.stackLg },
  sectionHeading: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.stackSm,
  },
  row: { gap: theme.spacing.stackXs },
}));
