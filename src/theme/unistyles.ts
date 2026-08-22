import {
  StyleSheet as UnistylesStyleSheet,
  UnistylesRuntime,
  useUnistyles,
  withUnistyles,
} from "react-native-unistyles";

import { breakpoints } from "./breakpoints";
import { appThemes } from "./theme";

type AppBreakpoints = typeof breakpoints;
type AppThemes = typeof appThemes;

declare module "react-native-unistyles" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesThemes extends AppThemes {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

UnistylesStyleSheet.configure({
  settings: {
    initialTheme: "dark",
  },
  breakpoints,
  themes: appThemes,
});

export const StyleSheet = UnistylesStyleSheet;
export { UnistylesRuntime, useUnistyles, withUnistyles };
