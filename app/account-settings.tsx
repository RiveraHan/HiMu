import { authApi } from "@/src/api/auth";
import { usePlayer } from "@/src/audio/use-player";
import {
  ScreenHeader,
  ScreenScrollView,
  SettingsDesktopGrid,
  SettingsDesktopGridItem,
  SettingsInfoRow,
  SettingsSection,
  StateNotice,
  Text,
} from "@/src/components";
import { useCurrentUser } from "@/src/hooks/use-auth";
import { useConfirm } from "@/src/hooks/use-confirm";
import { useOnlineStatus } from "@/src/hooks/use-online-status";
import { useProfile } from "@/src/hooks/use-profile";
import { useMiniPlayerPadding } from "@/src/hooks/use-tab-bar-padding";
import { useToast } from "@/src/hooks/use-toast";
import { useLocale } from "@/src/i18n/use-locale";
import { publicHttpsUrl } from "@/src/utils/public-url";
import * as Device from "expo-device";
import { router } from "expo-router";
import {
  ChevronDown,
  FileText,
  Gem,
  Languages,
  LogOut,
  Mail,
  Smartphone,
  ShieldCheck,
} from "lucide-react-native";
import { Alert, Linking, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "@/src/theme/react-native-unistyles";

export default function AccountSettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const { theme } = useUnistyles();
  const user = useCurrentUser();
  const online = useOnlineStatus();
  const profileQuery = useProfile();
  const profile = profileQuery.data;
  const { flushListeningStats } = usePlayer();
  const confirm = useConfirm();
  const toast = useToast();
  const { preference, resolvedLanguage, setPreference, isSaving } = useLocale();
  const profileOfflineWithoutData =
    !online &&
    profile === undefined &&
    profileQuery.fetchStatus === "paused";
  const blockingProfileError = profileQuery.isError && profile === undefined;

  const osLabel = [Device.osName, Device.osVersion].filter(Boolean).join(" ");
  const deviceName =
    Device.deviceName ??
    Device.modelName ??
    Device.productName ??
    t("settings.thisDevice");

  const legalLinks = [
    {
      label: t("common.auth.terms"),
      url: publicHttpsUrl(process.env.EXPO_PUBLIC_TERMS_URL),
      icon: <FileText size={20} color={theme.colors.onSurfaceVariant} />,
    },
    {
      label: t("common.auth.privacy"),
      url: publicHttpsUrl(process.env.EXPO_PUBLIC_PRIVACY_URL),
      icon: <ShieldCheck size={20} color={theme.colors.onSurfaceVariant} />,
    },
  ];
  const validLegalLinks = legalLinks.filter(
    (item): item is typeof item & { url: string } => item.url !== null,
  );

  const openLegal = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      toast.error(t("common.errors.generic"));
    }
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
    await flushListeningStats();
    await authApi.signOut();
    router.replace("/");
  };

  return (
    <ScreenScrollView
      testID="account-settings-scroll"
      style={styles.root}
      canvasVariant="wide"
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing.stackMd, paddingBottom },
      ]}
    >
      <ScreenHeader
        title={t("settings.header.title")}
        subtitle={t("settings.header.subtitle")}
      />

      <SettingsDesktopGrid testID="account-settings-grid">
        <SettingsDesktopGridItem testID="account-identity-zone">
          <SettingsSection title={t("settings.sections.account")}>
            <SettingsInfoRow
              icon={<Mail size={20} color={theme.colors.onSurfaceVariant} />}
              label={t("settings.email")}
              value={user?.email ?? "-"}
            />
            {profileOfflineWithoutData || blockingProfileError ? (
              <StateNotice
                compact
                kind={profileOfflineWithoutData ? "offline" : "error"}
                title={
                  profileOfflineWithoutData
                    ? t("common.errors.offline")
                    : t("profile.profileUnavailable")
                }
                actionLabel={t("common.actions.retry")}
                onAction={() => void profileQuery.refetch()}
              />
            ) : (
              <>
                <SettingsInfoRow
                  icon={<Gem size={20} color={theme.colors.onSurfaceVariant} />}
                  label={t("settings.subscription")}
                  value={
                    profile
                      ? profile.subscriptionTier === "premium"
                        ? t("settings.premium")
                        : t("settings.free")
                      : "—"
                  }
                />
                {profile && (profileQuery.isError || !online) ? (
                  <StateNotice
                    compact
                    kind={online ? "error" : "offline"}
                    title={t("profile.profileUnavailable")}
                    actionLabel={t("common.actions.retry")}
                    onAction={() => void profileQuery.refetch()}
                  />
                ) : null}
              </>
            )}
          </SettingsSection>
        </SettingsDesktopGridItem>

        <SettingsDesktopGridItem testID="account-language-zone">
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
              onPress={pickLanguage}
              disabled={isSaving}
              accessory={<ChevronDown size={20} color={theme.colors.outline} />}
            />
          </SettingsSection>
        </SettingsDesktopGridItem>

        <SettingsDesktopGridItem testID="account-session-zone">
          <SettingsSection title={t("settings.sections.devices")}>
            <SettingsInfoRow
              icon={
                <Smartphone size={20} color={theme.colors.primaryContainer} />
              }
              label={deviceName}
              value={`${t("settings.currentDevice")}${osLabel ? ` • ${osLabel}` : ""}`}
            />
          </SettingsSection>
        </SettingsDesktopGridItem>

        <SettingsDesktopGridItem testID="account-legal-zone">
          <SettingsSection title={t("settings.sections.legal")}>
            {validLegalLinks.map((item) => (
              <SettingsInfoRow
                key={item.label}
                icon={item.icon}
                label={item.label}
                onPress={() => void openLegal(item.url)}
                accessibilityRole="link"
              />
            ))}
            {legalLinks.some((item) => item.url === null) ? (
              <StateNotice
                compact
                kind="empty"
                title={t("settings.legalUnavailable")}
              />
            ) : null}
          </SettingsSection>
        </SettingsDesktopGridItem>

        <SettingsDesktopGridItem testID="account-destructive-zone" size="wide">
          <SettingsSection
            title={t("settings.sections.destructive")}
            tone="destructive"
            testID="account-destructive-section"
          >
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
          </SettingsSection>
        </SettingsDesktopGridItem>
      </SettingsDesktopGrid>
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
    minHeight: 44,
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
