import { useAuthStore } from "@/src/stores/auth-store";
import { TourTarget } from "@/src/onboarding";
import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import { Compass, Home, type LucideIcon, User } from "lucide-react-native";
import {
  ActivityIndicator,
  Platform,
  View
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StyleSheet, useUnistyles } from "react-native-unistyles";

function TabIcon({
  Icon,
  focused,
  target,
  testID,
}: {
  Icon: LucideIcon;
  focused: boolean;
  target?: "tabs.discover";
  testID?: string;
}) {
  const { theme } = useUnistyles();
  const icon = (
    <View
      style={[styles.tabIcon, focused && styles.tabIconActive]}
      testID={testID}
    >
      <Icon
        size={24}
        color={focused ? theme.colors.primary : theme.colors.onSurfaceVariant}
        opacity={focused ? 1 : 0.4}
      />
    </View>
  );
  return target ? (
    <TourTarget id={target} borderRadius={theme.borderRadius.full}>
      {icon}
    </TourTarget>
  ) : icon;
}

function TabBarBackground() {
  return (
    <View style={styles.barBg}>
      {process.env.EXPO_OS === "ios" && (
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      )}
    </View>
  );
}

export default function Applayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const session = useAuthStore((state) => state.session);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          marginHorizontal: "6%",
          bottom: insets.bottom + 8,
          height: 64,
          borderRadius: theme.borderRadius.full,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.glassBorder,
          backgroundColor: "transparent",
          ...Platform.select({
            ios: { boxShadow: theme.shadows.modal },
            android: { elevation: 0 },
          }),
        },
        tabBarIconStyle: {
          flex: 1,
        },
        tabBarItemStyle: {
          height: 64,
        },
        tabBarBackground: TabBarBackground,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarAccessibilityLabel: t("common.navigation.home"),
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={Home} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          tabBarAccessibilityLabel: t("common.navigation.discover"),
          tabBarIcon: ({ focused }) => (
            <TabIcon
              Icon={Compass}
              focused={focused}
              target="tabs.discover"
              testID="discover-tab-icon"
            />
          ),
        }}
      />
      {/* community stays hidden until it ships */}
      <Tabs.Screen name="community" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarAccessibilityLabel: t("common.navigation.profile"),
          tabBarIcon: ({ focused }) => (
            <TabIcon Icon={User} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create((theme) => ({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  barBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.borderRadius.full,
    overflow: "hidden",
    backgroundColor: "rgba(26,28,30,0.92)",
  },
  tabIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },
  tabIconActive: {
    backgroundColor: "rgba(189,194,255,0.16)",
    borderRadius: theme.borderRadius.full,
  },
}));
