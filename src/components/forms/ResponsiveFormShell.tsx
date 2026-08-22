import type { ReactNode } from "react";
import { View } from "react-native";

import { ScreenCanvas } from "@/src/components/ScreenCanvas";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

import { FormStepRail, type FormStep } from "./FormStepRail";
import { formLayout, responsiveFormStyle } from "./form-layout";
import { StickyReviewPanel } from "./StickyReviewPanel";

type Props = {
  title: string;
  description?: string;
  steps: readonly FormStep[];
  activeStep: string;
  form: ReactNode;
  review: ReactNode;
  footer: ReactNode;
};

/**
 * A presentation-only form frame. Its source order is intentionally stable:
 * header, progress rail, editor, review, then final action. Unistyles changes
 * the presentation at the desktop layout breakpoint without replacing content.
 */
export function ResponsiveFormShell({
  title,
  description,
  steps,
  activeStep,
  form,
  review,
  footer,
}: Props) {
  return (
    <ScreenCanvas variant="wide" testID="responsive-form-shell" style={styles.shell}>
      <ScreenHeader title={title} subtitle={description} />
      <View testID="responsive-form-content" style={styles.content}>
        <FormStepRail steps={steps} activeStep={activeStep} />
        <View testID="responsive-form-editor" style={styles.editor}>
          {form}
        </View>
        <StickyReviewPanel>{review}</StickyReviewPanel>
      </View>
      <View testID="responsive-form-footer" style={styles.footer}>
        {footer}
      </View>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create((theme) => ({
  shell: {
    gap: theme.spacing.stackLg,
    paddingTop: theme.spacing.stackMd,
    paddingBottom: theme.spacing.stackLg,
  },
  content: {
    flexDirection: responsiveFormStyle(
      formLayout.compact.contentDirection,
      formLayout.desktop.contentDirection,
    ),
    alignItems: responsiveFormStyle("stretch", "flex-start"),
    gap: theme.spacing.stackLg,
    minWidth: 0,
  },
  editor: {
    flex: responsiveFormStyle(0, 1),
    minWidth: 0,
    width: "100%",
  },
  footer: {
    position: formLayout.compact.footerPosition,
    width: "100%",
    minWidth: 0,
  },
}));
