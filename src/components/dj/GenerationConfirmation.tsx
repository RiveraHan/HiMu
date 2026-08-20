import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/src/components/Button";
import { GlassCard } from "@/src/components/GlassCard";
import { Text } from "@/src/components/Text";
import type { ConfirmedGenerationBriefV1 } from "@/src/types/creative-generation";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

type Props = {
  brief: ConfirmedGenerationBriefV1;
  disabled: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onGenerate: () => void;
};

export function GenerationConfirmation({
  brief,
  disabled,
  isSubmitting,
  onBack,
  onGenerate,
}: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <Text variant="h2">{t("dj.brief.confirmTitle")}</Text>
      <Text variant="bodyMd" color="onSurfaceVariant">
        {t("dj.brief.confirmSubtitle")}
      </Text>
      <GlassCard level={1} style={styles.preview}>
        <Text variant="h2">{brief.title}</Text>
        <Text variant="bodyMd">{brief.creativeDirection}</Text>
        <Text variant="labelCaps" color="onSurfaceVariant">
          {t(`dj.brief.mode.${brief.mode}`)} · {t(`dj.brief.visibility.${brief.visibility}`)}
        </Text>
        {brief.lyricTheme ? <Text variant="bodyMd">{brief.lyricTheme}</Text> : null}
        {brief.lyrics ? <Text variant="bodyMd">{brief.lyrics}</Text> : null}
      </GlassCard>
      <Button
        variant="glass"
        label={t("dj.brief.backToEdit")}
        disabled={isSubmitting}
        onPress={onBack}
      />
      <Button
        label={t("dj.brief.confirmGenerate")}
        loading={isSubmitting}
        loadingLabel={t("dj.brief.starting")}
        disabled={disabled}
        onPress={onGenerate}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { gap: theme.spacing.stackMd },
  preview: { gap: theme.spacing.stackSm },
}));
