import { usePlayer } from "@/src/audio/use-player";
import {
  ScreenHeader,
  ScreenScrollView,
  SettingsInfoRow,
  SettingsSection,
  SettingsToggleRow,
  Text,
} from "@/src/components";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useProfile } from "@/src/hooks/use-profile";
import { useSettings, useUpdateSettings } from "@/src/hooks/use-settings";
import { useConfirm } from "@/src/hooks/use-confirm";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { useLocale } from "@/src/i18n/use-locale";
import { DEFAULT_PREFERENCES, DownloadQuality } from "@/src/types/preferences";
import { router } from "expo-router";
import {
  AudioLines,
  ChevronDown,
  Gem,
  Languages,
  LogOut,
  Mail,
  Smartphone,
  Wifi,
} from "lucide-react-native";
import { Alert, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Device from "expo-device";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { authApi } from "@/src/api/auth";

export default function AccountSettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const { theme } = useUnistyles();
  const user = useCurrentUser();
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const { mutate: updateSettings } = useUpdateSettings();
  const { flushListeningStats } = usePlayer();
  const confirm = useConfirm();
  const { preference, resolvedLanguage, setPreference, isSaving } = useLocale();

  const isPro = profile?.subscriptionTier === "premium";
  const prefs = settings ?? DEFAULT_PREFERENCES;
  const ready = !!settings;

  const osLabel = [Device.osName, Device.osVersion].filter(Boolean).join(" ");
  const deviceName =
    Device.deviceName ??
    Device.modelName ??
    Device.productName ??
    t("settings.thisDevice");

  const setLossless = (lossless: boolean) =>
    updateSettings({ audio: { lossless } });

  const setPush = (push: boolean) =>
    updateSettings({ notifications: { push } });

  const setNewsletters = (emailNewsletters: boolean) =>
    updateSettings({ notifications: { emailNewsletters } });

  const setDownloadQuality = (downloadQuality: DownloadQuality) =>
    updateSettings({ audio: { downloadQuality } });

  const pickDownloadQuality = () => {
    Alert.alert(t("settings.downloadQuality"), undefined, [
      {
        text: t("settings.quality.low"),
        onPress: () => setDownloadQuality("low"),
      },
      {
        text: t("settings.quality.high"),
        onPress: () => setDownloadQuality("high"),
      },
      {
        text: t("settings.quality.lossless"),
        onPress: () => setDownloadQuality("lossless"),
      },
      { text: t("common.actions.cancel"), style: "cancel" },
    ]);
  };

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

  const onSignOut = async () => {
    const ok = await confirm({
      title: t("settings.signOut"),
      message: t("settings.signOutQuestion"),
      confirmLabel: t("settings.signOut"),
      destructive: true,
    });
    if (!ok) return;
    await flushListeningStats(); // guarda lo acumulado con la sesión viva
    await authApi.signOut();
    router.replace("/");
  };

  return (
    <ScreenScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
      ]}
    >
        <ScreenHeader
          title={t("settings.header.title")}
          subtitle={t("settings.header.subtitle")}
        />

        {/*Account Information*/}
        <SettingsSection title={t("settings.sections.account")}>
          <SettingsInfoRow
            icon={<Mail size={20} color={theme.colors.onSurfaceVariant} />}
            label={t("settings.email")}
            opacity={0.6}
            value={user?.email ?? "-"}
          />
          <SettingsInfoRow
            icon={<Gem size={20} color={theme.colors.onSurfaceVariant} />}
            label={t("settings.subscription")}
            value={isPro ? t("settings.premium") : t("settings.free")}
            valueColor={isPro ? "primaryContainer" : "onSurfaceVariant"}
          />
        </SettingsSection>

        <SettingsSection title={t("settings.sections.language")}>
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
            onPress={isSaving ? undefined : pickLanguage}
            accessory={<ChevronDown size={20} color={theme.colors.outline} />}
          />
        </SettingsSection>

        {/*Audio Quality*/}
        <SettingsSection title={t("settings.sections.audio")}>
          <SettingsToggleRow
            icon={
              <AudioLines
                size={20}
                color={
                  prefs.audio.lossless
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
              />
            }
            label={t("settings.lossless")}
            description={t("settings.losslessDescription")}
            value={prefs.audio.lossless}
            disabled={!ready}
            onValueChange={setLossless}
          />

          <SettingsInfoRow
            icon={<Wifi size={20} color={theme.colors.onSurfaceVariant} />}
            label={t("settings.downloadQuality")}
            value={t(`settings.quality.${prefs.audio.downloadQuality}`)}
            onPress={ready ? pickDownloadQuality : undefined}
            accessory={<ChevronDown size={20} color={theme.colors.outline} />}
          />
        </SettingsSection>

        {/*Notifications*/}
        <SettingsSection title={t("settings.sections.notifications")}>
          <SettingsToggleRow
            label={t("settings.push")}
            description={t("settings.pushDescription")}
            value={prefs.notifications.push}
            disabled={!ready}
            onValueChange={setPush}
          />
          <SettingsToggleRow
            label={t("settings.newsletters")}
            description={t("settings.newslettersDescription")}
            value={prefs.notifications.emailNewsletters}
            disabled={!ready}
            onValueChange={setNewsletters}
          />
        </SettingsSection>

        {/*Connected Devices*/}
        <SettingsSection title={t("settings.sections.devices")}>
          <SettingsInfoRow
            icon={
              <Smartphone size={20} color={theme.colors.primaryContainer} />
            }
            label={deviceName}
            value={`${t("settings.currentDevice")}${osLabel ? ` • ${osLabel}` : ""}`}
          />
        </SettingsSection>

        {/*Sign Out*/}
        <Pressable
          onPress={onSignOut}
          accessibilityLabel={t("settings.signOut")}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.signOut,
            pressed && styles.signOutPressed,
          ]}
        >
          <LogOut size={20} color={theme.colors.error} />
          <Text variant="labelCaps" color="error">
            {t("settings.signOut")}
          </Text>
        </Pressable>
    </ScreenScrollView>
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
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.stackSm,
    alignSelf: "center",
    paddingHorizontal: theme.spacing.stackLg,
    paddingVertical: theme.spacing.stackMd - 4,
    borderRadius: theme.borderRadius.full,
    backgroundColor: "rgba(147,0,10,0.10)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,180,171,0.20)",
  },
  signOutPressed: {
    opacity: 0.7,
  },
}));
