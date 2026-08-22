import type { ReactNode } from "react";
import { View } from "react-native";

import { Text } from "@/src/components/Text";
import type { LayoutMode } from "@/src/theme/layout";
import { StyleSheet } from "@/src/theme/react-native-unistyles";

export type FormStep = {
  id: string;
  label: string;
  description?: string;
};

type Props = {
  steps: readonly FormStep[];
  activeStep: string;
  children?: ReactNode;
};

// Desktop is the only layout mode that presents the progress rail. The shell
// keeps it in source order so the compact form never needs a separate tree.
const railLayoutMode: LayoutMode = "desktop";

export function FormStepRail({ steps, activeStep, children }: Props) {
  return (
    <View
      testID="form-step-rail"
      accessibilityRole="list"
      accessibilityLabel="Form steps"
      style={styles.rail}
    >
      {steps.map((step, index) => {
        const active = step.id === activeStep;

        return (
          <View key={step.id} role="listitem" style={styles.step}>
            <Text
              variant="labelCaps"
              color={active ? "primary" : "outline"}
              accessibilityState={{ selected: active }}
            >
              {String(index + 1).padStart(2, "0")}
            </Text>
            <View style={styles.copy}>
              <Text
                variant="bodyMd"
                color={active ? "onSurface" : "onSurfaceVariant"}
                accessibilityState={{ selected: active }}
              >
                {step.label}
              </Text>
              {step.description ? (
                <Text variant="bodyMd" color="outline">
                  {step.description}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  rail: {
    display: { xs: "none", xl: railLayoutMode === "desktop" ? "flex" : "none" },
    flex: { xs: 0, xl: 1 },
    minWidth: 180,
    maxWidth: 240,
    gap: theme.spacing.stackMd,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.stackSm,
  },
  copy: {
    flex: 1,
    gap: theme.spacing.stackXs,
    minWidth: 0,
  },
}));
