import type { ReactNode } from "react";
import { Platform, ScrollView, useWindowDimensions, View } from "react-native";

import { ScreenCanvas } from "@/src/components/ScreenCanvas";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

import { FormStepRail, type FormStep } from "./FormStepRail";
import {
  formLayoutContract,
  formScrollViewProps,
  responsiveFormStyle,
  resolveResponsiveFormStyle,
} from "./form-layout";
import { StickyReviewPanel } from "./StickyReviewPanel";

type Props = {
  title: string;
  description?: string;
  headerDisabled?: boolean;
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
  headerDisabled = false,
  steps,
  activeStep,
  form,
  review,
  footer,
}: Props) {
  const { width } = useWindowDimensions();

  return (
    <ScrollView
      {...formScrollViewProps}
      testID="responsive-form-scroll-view"
    >
      <ScreenCanvas variant="wide" testID="responsive-form-shell" style={styles.shell}>
        <ScreenHeader
          title={title}
          subtitle={description}
          disabled={headerDisabled}
        />
        <View
          testID="responsive-form-content"
          style={[
            styles.content,
            Platform.OS === "web" ? {
              flexDirection: resolveResponsiveFormStyle(
                formLayoutContract.contentDirection,
                width,
              ),
            } : undefined,
          ]}
        >
          <FormStepRail steps={steps} activeStep={activeStep} />
          <View
            testID="responsive-form-editor"
            style={[
              styles.editor,
              Platform.OS === "web" ? {
                flex: resolveResponsiveFormStyle(
                  formLayoutContract.editorFlex,
                  width,
                ),
              } : undefined,
            ]}
          >
            {form}
          </View>
          <StickyReviewPanel>{review}</StickyReviewPanel>
        </View>
        <View testID="responsive-form-footer" style={styles.footer}>
          {footer}
        </View>
      </ScreenCanvas>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  shell: {
    gap: theme.spacing.stackLg,
    paddingTop: theme.spacing.stackMd,
    paddingBottom: theme.spacing.stackLg,
  },
  content: {
    flexDirection: formLayoutContract.contentDirection,
    alignItems: responsiveFormStyle("stretch", "flex-start"),
    gap: theme.spacing.stackLg,
    minWidth: 0,
  },
  editor: {
    flex: formLayoutContract.editorFlex,
    minWidth: 0,
    width: "100%",
  },
  footer: {
    ...formLayoutContract.footerStyle,
    width: "100%",
    minWidth: 0,
  },
}));
