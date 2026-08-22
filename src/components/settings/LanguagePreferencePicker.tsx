import { Alert } from "react-native";
import { ChevronDown, Languages } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { useLocale } from "@/src/i18n/use-locale";
import { useUnistyles } from "@/src/theme/react-native-unistyles";

import { SettingsInfoRow } from "./SettingsInfoRow";

export function LanguagePreferencePicker() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const { preference, resolvedLanguage, setPreference, isSaving } = useLocale();

  const pickLanguage = () => {
    Alert.alert(t("settings.sections.language"), undefined, [
      {
        text: t("settings.language.system"),
        onPress: () => void setPreference("system"),
      },
      {
        text: t("settings.language.en"),
        onPress: () => void setPreference("en"),
      },
      {
        text: t("settings.language.es"),
        onPress: () => void setPreference("es"),
      },
      { text: t("common.actions.cancel"), style: "cancel" },
    ]);
  };

  return (
    <SettingsInfoRow
      icon={<Languages size={20} color={theme.colors.onSurfaceVariant} />}
      label={t("settings.language.label")}
      value={
        preference === "system"
          ? t("settings.language.systemResolved", {
              language: t(`settings.language.${resolvedLanguage}`),
            })
          : t(`settings.language.${preference}`)
      }
      onPress={pickLanguage}
      disabled={isSaving}
      accessory={<ChevronDown size={20} color={theme.colors.outline} />}
    />
  );
}
