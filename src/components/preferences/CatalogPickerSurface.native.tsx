import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Button } from "@/src/components/Button";
import { GlassInput } from "@/src/components/GlassInput";
import { Text } from "@/src/components/Text";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import type { CatalogPickerSurfaceProps } from "./progressive-catalog-types";

export function catalogPickerKeyboardBehavior(platform: string): "height" | "padding" {
  return platform === "android" ? "height" : "padding";
}

export function CatalogPickerSurface({
  visible,
  title,
  query,
  onQueryChange,
  onDone,
  onRequestClose,
  children,
}: CatalogPickerSurfaceProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const searchLabel = t("common.catalogPicker.search", { title });

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onRequestClose}
      testID="catalog-picker-modal"
    >
      <KeyboardAvoidingView
        behavior={catalogPickerKeyboardBehavior(Platform.OS)}
        style={styles.backdrop}
      >
        <Pressable accessible={false} onPress={onRequestClose} style={StyleSheet.absoluteFill} />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
        >
          <View style={styles.heading}>
            <Text accessibilityRole="header" variant="h2">{title}</Text>
            <Button label={t("common.catalogPicker.done")} variant="ghost" onPress={onDone} />
          </View>
          <GlassInput
            placeholder={searchLabel}
            value={query}
            onChangeText={onQueryChange}
            accessibilityLabel={searchLabel}
            style={styles.search}
          />
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  sheet: {
    maxHeight: "85%",
    gap: theme.spacing.stackMd,
    paddingTop: theme.spacing.cardPadding,
    paddingHorizontal: theme.spacing.cardPadding,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.surfaceContainer,
  },
  heading: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  search: { minHeight: 44 },
  scrollContent: { gap: theme.spacing.stackSm, paddingBottom: theme.spacing.stackMd },
}));
