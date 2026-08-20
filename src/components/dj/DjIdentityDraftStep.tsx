import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/src/components/Button";
import { GlassInput } from "@/src/components/GlassInput";
import { Text } from "@/src/components/Text";
import { PrefSection } from "@/src/components/preferences/PrefSection";
import { useLocale } from "@/src/i18n/use-locale";
import { useDjIdentityDrafts } from "@/src/hooks/use-creative-draft";
import type {
  DjDraftTraits,
  DjIdentityCandidate,
} from "@/src/types/creative-generation";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

export type DjIdentityDraftValue = {
  name: string;
  identityConcept: string;
  provenance: "suggested" | "edited" | "custom";
  confirmed: boolean;
};

type Props = {
  traits: DjDraftTraits;
  value: DjIdentityDraftValue;
  onChange: (value: DjIdentityDraftValue) => void;
  disabled?: boolean;
};

function traitsFingerprint(traits: DjDraftTraits): string {
  return JSON.stringify([
    traits.genres,
    traits.moods,
    traits.energy,
    traits.isInstrumental,
    traits.vibe,
  ]);
}

function canDraft(traits: DjDraftTraits): boolean {
  return traits.genres.length > 0 && traits.moods.length > 0;
}

function canConfirm(value: DjIdentityDraftValue): boolean {
  const name = value.name.trim();
  const concept = value.identityConcept.trim();
  return name.length >= 2 && name.length <= 24 && concept.length >= 10 && concept.length <= 240;
}

export function DjIdentityDraftStep({
  traits,
  value,
  onChange,
  disabled = false,
}: Props) {
  const { t } = useTranslation();
  const { resolvedLanguage: language } = useLocale();
  const draftMutation = useDjIdentityDrafts();
  const [candidates, setCandidates] = useState<DjIdentityCandidate[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [draftFailed, setDraftFailed] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const fingerprint = useMemo(() => traitsFingerprint(traits), [traits]);
  const previousFingerprint = useRef(fingerprint);
  const requestedFingerprint = useRef<string | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  async function requestDrafts() {
    if (!canDraft(traits) || disabled) return;
    requestedFingerprint.current = fingerprint;
    setDraftFailed(false);
    try {
      const response = await draftMutation.mutateAsync({
        language,
        traits,
        exclude: candidates.map((candidate) => candidate.name),
      });
      if (response.kind !== "dj-identity") throw new Error("invalid identity draft");
      setCandidates(response.draft.candidates);
      setSelectedName(null);
    } catch {
      setDraftFailed(true);
    }
  }

  useEffect(() => {
    if (previousFingerprint.current !== fingerprint) {
      previousFingerprint.current = fingerprint;
      const current = valueRef.current;
      if (current.confirmed) {
        onChangeRef.current({ ...current, confirmed: false });
      }
      if (current.name || current.identityConcept) setIsStale(true);
    }
    if (
      canDraft(traits) &&
      !disabled &&
      requestedFingerprint.current !== fingerprint
    ) {
      void requestDrafts();
    }
    // Traits are intentionally the only automatic-draft trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, disabled]);

  function selectCandidate(candidate: DjIdentityCandidate) {
    setIsStale(false);
    setSelectedName(candidate.name);
    onChange({
      name: candidate.name,
      identityConcept: candidate.identityConcept,
      provenance: "suggested",
      confirmed: false,
    });
  }

  function edit(field: "name" | "identityConcept", text: string) {
    setIsStale(false);
    onChange({
      ...value,
      [field]: text,
      provenance: value.provenance === "custom" ? "custom" : "edited",
      confirmed: false,
    });
  }

  function startCustom() {
    setIsStale(false);
    setSelectedName(null);
    onChange({
      name: "",
      identityConcept: "",
      provenance: "custom",
      confirmed: false,
    });
  }

  return (
    <PrefSection
      title={t("dj.identity.title")}
      subtitle={t("dj.identity.subtitle")}
    >
      {draftFailed ? (
        <Text color="error">{t("dj.identity.unavailable")}</Text>
      ) : null}

      {candidates.length > 0 ? (
        <View style={styles.candidates} accessibilityRole="radiogroup">
          {candidates.map((candidate) => {
            const selected = selectedName === candidate.name;
            return (
              <Pressable
                key={candidate.name}
                accessibilityRole="radio"
                accessibilityLabel={`${candidate.name}. ${candidate.identityConcept}`}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => selectCandidate(candidate)}
                style={[styles.candidate, selected && styles.candidateSelected]}
              >
                <Text variant="bodyLg">{candidate.name}</Text>
                <Text color="onSurfaceVariant">{candidate.identityConcept}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          variant="glass"
          label={t("dj.identity.regenerate")}
          loading={draftMutation.isPending}
          loadingLabel={t("dj.identity.generating")}
          disabled={disabled || !canDraft(traits)}
          onPress={() => void requestDrafts()}
        />
        <Button
          variant="ghost"
          label={t("dj.identity.custom")}
          disabled={disabled}
          onPress={startCustom}
        />
      </View>

      <GlassInput
        accessibilityLabel={t("dj.identity.nameLabel")}
        placeholder={t("dj.identity.namePlaceholder")}
        value={value.name}
        onChangeText={(text) => edit("name", text)}
        maxLength={24}
        editable={!disabled}
      />
      <GlassInput
        accessibilityLabel={t("dj.identity.conceptLabel")}
        placeholder={t("dj.identity.conceptPlaceholder")}
        value={value.identityConcept}
        onChangeText={(text) => edit("identityConcept", text)}
        maxLength={240}
        multiline
        editable={!disabled}
      />

      {value.confirmed ? (
        <Text color="primary">{t("dj.identity.confirmed")}</Text>
      ) : value.name || value.identityConcept ? (
        <Text color="onSurfaceVariant">
          {isStale
            ? t("dj.identity.stale")
            : value.provenance === "edited"
            ? t("dj.identity.edited")
            : t("dj.identity.draft")}
        </Text>
      ) : null}

      <Button
        label={t("dj.identity.confirm")}
        disabled={disabled || !canConfirm(value)}
        onPress={() => onChange({ ...value, confirmed: true })}
      />
    </PrefSection>
  );
}

const styles = StyleSheet.create((theme) => ({
  candidates: { gap: theme.spacing.stackSm },
  candidate: {
    padding: theme.spacing.stackMd,
    gap: theme.spacing.stackXs,
    borderRadius: theme.borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.glassBorder,
    backgroundColor: theme.colors.glassTint,
  },
  candidateSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryContainer,
  },
  actions: { gap: theme.spacing.stackXs },
}));
