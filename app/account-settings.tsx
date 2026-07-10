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
import { DEFAULT_PREFERENCES, DownloadQuality } from "@/src/types/preferences";
import { router } from "expo-router";
import {
  AudioLines,
  ChevronDown,
  Gem,
  LogOut,
  Mail,
  Smartphone,
  Wifi,
} from "lucide-react-native";
import { Alert, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Device from "expo-device";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { authApi } from "@/src/api/auth";

const QUALITY_LABELS: Record<DownloadQuality, string> = {
  low: "Low (96 kbps)",
  high: "High (256kbps)",
  lossless: "Lossless",
};

export default function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
  const paddingBottom = useMiniPlayerPadding();
  const { theme } = useUnistyles();
  const user = useCurrentUser();
  const { data: profile } = useProfile();
  const { data: settings } = useSettings();
  const { mutate: updateSettings } = useUpdateSettings();
  const { flushListeningStats } = usePlayer();
  const confirm = useConfirm();

  const isPro = profile?.subscriptionTier === "premium";
  const prefs = settings ?? DEFAULT_PREFERENCES;
  const ready = !!settings;

  const osLabel = [Device.osName, Device.osVersion].filter(Boolean).join(" ");
  const deviceName =
    Device.deviceName ??
    Device.modelName ??
    Device.productName ??
    "This Device";

  const setLossless = (lossless: boolean) =>
    updateSettings({ ...prefs, audio: { ...prefs.audio, lossless } });

  const setPush = (push: boolean) =>
    updateSettings({
      ...prefs,
      notifications: { ...prefs.notifications, push },
    });

  const setNewsletters = (emailNewsletters: boolean) =>
    updateSettings({
      ...prefs,
      notifications: { ...prefs.notifications, emailNewsletters },
    });

  const setDownloadQuality = (downloadQuality: DownloadQuality) =>
    updateSettings({ ...prefs, audio: { ...prefs.audio, downloadQuality } });

  const pickDownloadQuality = () => {
    Alert.alert("Download Quality", undefined, [
      { text: QUALITY_LABELS.low, onPress: () => setDownloadQuality("low") },
      { text: QUALITY_LABELS.high, onPress: () => setDownloadQuality("high") },
      {
        text: QUALITY_LABELS.lossless,
        onPress: () => setDownloadQuality("lossless"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const onSignOut = async () => {
    const ok = await confirm({
      title: "Sign Out",
      message: "Are you sure you want to sign out?",
      confirmLabel: "Sign Out",
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
          title="Settings"
          subtitle="Manage your HiMu experience"
        />

        {/*Account Information*/}
        <SettingsSection title="Account Information">
          <SettingsInfoRow
            icon={<Mail size={20} color={theme.colors.onSurfaceVariant} />}
            label="Email Address"
            opacity={0.6}
            value={user?.email ?? "-"}
          />
          <SettingsInfoRow
            icon={<Gem size={20} color={theme.colors.onSurfaceVariant} />}
            label="Subscription"
            value={isPro ? "HiMu Premium" : "Free"}
            valueColor={isPro ? "primaryContainer" : "onSurfaceVariant"}
          />
        </SettingsSection>

        {/*Audio Quality*/}
        <SettingsSection title="Audio Quality">
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
            label="Lossless High-Fidelity"
            description="Stream at 24-bit/192kH"
            value={prefs.audio.lossless}
            disabled={!ready}
            onValueChange={setLossless}
          />

          <SettingsInfoRow
            icon={<Wifi size={20} color={theme.colors.onSurfaceVariant} />}
            label="Download Quality"
            value={QUALITY_LABELS[prefs.audio.downloadQuality]}
            onPress={ready ? pickDownloadQuality : undefined}
            accessory={<ChevronDown size={20} color={theme.colors.outline} />}
          />
        </SettingsSection>

        {/*Noifications*/}
        <SettingsSection title="Notifications">
          <SettingsToggleRow
            label="Push Notifications"
            description="New releases and listening stats"
            value={prefs.notifications.push}
            disabled={!ready}
            onValueChange={setPush}
          />
          <SettingsToggleRow
            label="Email Newsletters"
            description="Curated weekly digests"
            value={prefs.notifications.emailNewsletters}
            disabled={!ready}
            onValueChange={setNewsletters}
          />
        </SettingsSection>

        {/*Connected Devives*/}
        <SettingsSection title="Connected Devices">
          <SettingsInfoRow
            icon={
              <Smartphone size={20} color={theme.colors.primaryContainer} />
            }
            label={deviceName}
            value={`Current Device${osLabel ? ` • ${osLabel}` : ""}`}
          />
        </SettingsSection>

        {/*Sign Out*/}
        <Pressable
          onPress={onSignOut}
          accessibilityLabel="Sign Out"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.signOut,
            pressed && styles.signOutPressed,
          ]}
        >
          <LogOut size={20} color={theme.colors.error} />
          <Text variant="labelCaps" color="error">
            SIGN OUT
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
