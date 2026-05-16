import { DarkTheme } from "@react-navigation/native";

export const ThemeDark = {
  colors: {
    background: "#131318",
    surface: "#131318",
    surfaceDim: "#131318",
    surfaceBright: "#39383e",
    surfaceContainerLowest: "#0e0e13",
    surfaceContainerLow: "#1b1b20",
    surfaceContainer: "#1f1f24",
    surfaceContainerHigh: "#2a292f",
    surfaceContainerHighest: "#35343a",
    onSurface: "#e4e1e9",
    onSurfaceVariant: "#c6c5d5",
    inverseSurface: "#e4e1e9",
    inverseOnSurface: "#303035",
    outline: "#908f9e",
    outlineVariant: "#454653",
    surfaceTint: "#bdc2ff",
    primary: "#bdc2ff",
    onPrimary: "#131e8c",
    primaryContainer: "#818cf8",
    onPrimaryContainer: "#101b8a",
    inversePrimary: "#4953bc",
    secondary: "#c6c7c6",
    onSecondary: "#2f3130",
    secondaryContainer: "#454747",
    onSecondaryContainer: "#b4b5b4",
    tertiary: "#ddb8ff",
    onTertiary: "#490081",
    tertiaryContainer: "#b67af1",
    onTertiaryContainer: "#46007b",
    error: "#ffb4ab",
    onError: "#690005",
    errorContainer: "#93000a",
    onErrorContainer: "#ffdad6",
  },
  spacing: {
    unit: 8,
    pageMargin: 24,
    gutter: 16,
    stackSm: 8,
    stackMd: 16,
    stackLg: 32,
    safeAreaBottom: 34,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    "2xl": 24,
    "3xl": 32,
    full: 9999,
  },
  typography: {
    display: {
      fontFamily: "Manrope-Bold",
      fontSize: 40,
      lineHeight: 44,
      letterSpacing: -0.04 * 40,
    },
    h1: {
      fontFamily: "Manrope-Bold",
      fontSize: 32,
      lineHeight: 38.4,
      letterSpacing: -0.03 * 32,
    },
    h2: {
      fontFamily: "Manrope-SemiBold",
      fontSize: 24,
      lineHeight: 31.2,
      letterSpacing: -0.02 * 24,
    },
    bodyLg: { fontFamily: "Manrope-Regular", fontSize: 18, lineHeight: 28.8 },
    bodyMd: { fontFamily: "Manrope-Regular", fontSize: 16, lineHeight: 25.6 },
    labelMd: {
      fontFamily: "Manrope-Medium",
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0.01 * 14,
    },
    labelCaps: {
      fontFamily: "Manrope-SemiBold",
      fontSize: 12,
      lineHeight: 12,
      letterSpacing: 0.1 * 12,
    },
  },
} as const;

export const lightTheme = {
  ...ThemeDark,
  colors: {
    ...ThemeDark.colors,
    // invert background and surface for light theme
    background: "#ffffff",
    surface: "#ffffff",
    onSurface: "#1c1b1f",
  },
} as const;

export const appThemes = {
  dark: DarkTheme,
  light: lightTheme,
} as const;
