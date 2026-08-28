import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, findNodeHandle, Pressable, Text as RNText, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/src/components/Button";
import { GlassInput } from "@/src/components/GlassInput";
import { Text } from "@/src/components/Text";
import { PrefSection } from "@/src/components/preferences/PrefSection";
import type { DjIdentityController } from "@/src/hooks/use-dj-identity-controller";
import type { DjIdentityDraftValue } from "@/src/components/dj/DjIdentityDraftStep";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

type Props = Readonly<{
  controller: DjIdentityController;
  value: DjIdentityDraftValue;
  disabled?: boolean;
  onContinue?: () => void;
}>;

function canContinue(value: DjIdentityDraftValue, selectedName: string | null): boolean {
  const name = value.name.trim();
  const concept = value.identityConcept.trim();
  const hasValidText = name.length >= 2 && name.length <= 24 && concept.length >= 10 && concept.length <= 240;
  return hasValidText && (selectedName !== null || value.provenance !== "suggested");
}

export function CreateDjIdentityStep({ controller, value, disabled = false, onContinue }: Props) {
  const { t } = useTranslation();
  const headingRef = useRef<RNText>(null);
  const [editing, setEditing] = useState(value.provenance !== "suggested" && Boolean(value.name || value.identityConcept));
  const busy = controller.status === "loading";
  const validToContinue = canContinue(value, controller.selectedName);

  useEffect(() => {
    if (value.provenance !== "suggested" && (value.name || value.identityConcept)) setEditing(true);
  }, [value.identityConcept, value.name, value.provenance]);

  useEffect(() => {
    const node = findNodeHandle(headingRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);

  function startCustom() {
    setEditing(true);
    controller.startCustom();
  }

  function select(candidate: (typeof controller.candidates)[number]) {
    setEditing(false);
    controller.select(candidate);
  }

  function continueIdentity() {
    if (!validToContinue || disabled || busy) return;
    controller.confirm();
    onContinue?.();
  }

  return (
    <PrefSection title={t("dj.identity.title")} titleRef={headingRef} subtitle={t("dj.identity.subtitle")}>
      <View accessibilityLiveRegion="polite">
        {busy ? <Text>{t("dj.identity.generating")}</Text> : null}
        {controller.status === "error" ? <Text color="error">{t("dj.identity.unavailable")}</Text> : null}
      </View>

      {controller.status === "ready" && controller.candidates.length > 0 ? (
        <View style={styles.candidates} accessibilityRole="radiogroup">
          {controller.candidates.map((candidate) => {
            const selected = controller.selectedName === candidate.name;
            return <Pressable key={candidate.name} accessibilityRole="radio" accessibilityLabel={`${candidate.name}. ${candidate.identityConcept}`} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => select(candidate)} style={[styles.candidate, selected && styles.candidateSelected]}>
              <Text variant="bodyLg">{candidate.name}</Text>
              <Text color="onSurfaceVariant">{candidate.identityConcept}</Text>
            </Pressable>;
          })}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button variant="glass" label={t("dj.identity.regenerate")} loading={busy} loadingLabel={t("dj.identity.generating")} disabled={disabled || busy} onPress={() => void controller.request()} />
        <Button variant="ghost" label={t("dj.identity.custom")} disabled={disabled} onPress={startCustom} />
        {controller.selectedName && !editing ? <Button variant="ghost" label={t("dj.identity.edit")} disabled={disabled} onPress={() => setEditing(true)} /> : null}
      </View>

      {editing ? <View style={styles.actions}>
        <GlassInput accessibilityLabel={t("dj.identity.nameLabel")} placeholder={t("dj.identity.namePlaceholder")} value={value.name} onChangeText={(text) => controller.edit("name", text)} maxLength={24} editable={!disabled} />
        <GlassInput accessibilityLabel={t("dj.identity.conceptLabel")} placeholder={t("dj.identity.conceptPlaceholder")} value={value.identityConcept} onChangeText={(text) => controller.edit("identityConcept", text)} maxLength={240} multiline editable={!disabled} />
      </View> : null}

      <Button label={t("dj.identity.continue")} disabled={disabled || busy || !validToContinue} onPress={continueIdentity} />
    </PrefSection>
  );
}

const styles = StyleSheet.create((theme) => ({
  candidates: { gap: theme.spacing.stackSm },
  candidate: { padding: theme.spacing.stackMd, gap: theme.spacing.stackXs, borderRadius: theme.borderRadius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.glassBorder, backgroundColor: theme.colors.glassTint },
  candidateSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryContainer },
  actions: { gap: theme.spacing.stackXs },
}));
