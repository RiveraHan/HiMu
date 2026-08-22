import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/src/components/Button";
import { GlassInput } from "@/src/components/GlassInput";
import { Text } from "@/src/components/Text";
import { VisibilityField } from "@/src/components/content/VisibilityField";
import type {
  EditableBriefField,
  GenerationBriefState,
  RegeneratableBriefField,
} from "@/src/utils/generation-brief-state";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

type Props = {
  state: GenerationBriefState;
  disabled: boolean;
  isOnline: boolean;
  pendingField: RegeneratableBriefField | null;
  errors: Partial<Record<RegeneratableBriefField, string>>;
  onEdit: (field: EditableBriefField, value: string) => void;
  onRegenerate: (field: RegeneratableBriefField) => void;
};

export function GenerationBriefEditor({
  state,
  disabled,
  isOnline,
  pendingField,
  errors,
  onEdit,
  onRegenerate,
}: Props) {
  const { t } = useTranslation();
  const { draft } = state;
  const blocked = disabled || !isOnline;
  const regenerate = (field: RegeneratableBriefField) => (
    <View style={styles.regenerate}>
      <Button
        variant="ghost"
        label={t(`dj.brief.regenerate.${field}`)}
        loading={pendingField === field}
        loadingLabel={t("dj.brief.regenerating")}
        disabled={blocked || (pendingField != null && pendingField !== field)}
        onPress={() => onRegenerate(field)}
      />
      {errors[field] ? (
        <Text variant="bodyMd" color="error">{errors[field]}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <GlassInput
        accessibilityLabel={t("dj.brief.titleLabel")}
        label={t("dj.brief.titleLabel")}
        value={draft.title}
        maxLength={80}
        editable={!disabled}
        onChangeText={(value) => onEdit("title", value)}
      />
      {regenerate("title")}

      <GlassInput
        accessibilityLabel={t("dj.brief.directionLabel")}
        label={t("dj.brief.directionLabel")}
        value={draft.creativeDirection}
        maxLength={500}
        multiline
        editable={!disabled}
        onChangeText={(value) => onEdit("creativeDirection", value)}
      />
      {regenerate("creativeDirection")}

      {draft.mode === "vocal" ? (
        <>
          <GlassInput
            accessibilityLabel={t("dj.brief.themeLabel")}
            label={t("dj.brief.themeLabel")}
            value={draft.lyricTheme ?? ""}
            maxLength={120}
            editable={!disabled}
            onChangeText={(value) => onEdit("lyricTheme", value)}
          />
          <GlassInput
            accessibilityLabel={t("dj.brief.lyricsLabel")}
            label={t("dj.brief.lyricsLabel")}
            value={draft.lyrics ?? ""}
            maxLength={1000}
            multiline
            editable={!disabled}
            onChangeText={(value) => onEdit("lyrics", value)}
          />
          {regenerate("lyrics")}
        </>
      ) : null}

      <VisibilityField
        resource="track"
        value={draft.visibility}
        disabled={disabled}
        onChange={(value) => onEdit("visibility", value)}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { gap: theme.spacing.stackMd },
  regenerate: { alignItems: "flex-start", gap: theme.spacing.stackXs },
}));
