import type { ReactNode } from "react";
import { useWindowDimensions, View, type ViewProps } from "react-native";
import { StyleSheet } from "@/src/theme/react-native-unistyles";
import { canvasMaxWidth } from "@/src/theme/layout";
import { resolveBetaVisualLayout } from "./beta-visual-layout";

export type ScreenCanvasVariant = keyof typeof canvasMaxWidth;

type Props = ViewProps & {
  variant?: ScreenCanvasVariant;
  actions?: ReactNode;
};

export function ScreenCanvas({
  variant = "readable",
  children,
  actions,
  style,
  ...rest
}: Props) {
  return (
    <View
      {...rest}
      style={[
        styles.canvas(canvasMaxWidth[variant]),
        style,
      ]}
    >
      {children}
      {actions ? (
        <ScreenCanvasActions>{actions}</ScreenCanvasActions>
      ) : null}
    </View>
  );
}

function ScreenCanvasActions({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const layout = resolveBetaVisualLayout({ width, height });

  return (
    <View
      testID="screen-canvas-actions"
      style={[
        styles.actions,
        layout.useDocumentFlowActions
          ? styles.documentFlowActions
          : styles.wideActions,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  canvas: (maxWidth: number) => ({
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: theme.spacing.pageMargin,
    maxWidth: { xs: undefined, lg: maxWidth },
  }),
  actions: {
    position: "relative",
    maxWidth: "100%",
    minWidth: 0,
    flexWrap: "wrap",
  },
  documentFlowActions: {
    alignSelf: "stretch",
  },
  wideActions: {
    alignSelf: "flex-end",
  },
}));
