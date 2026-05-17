export const darkTheme = {
  colors: {
    // Surfaces & backgrounds
    background: "#131318",
    onBackground: "#e4e1e9",
    surface: "#131318",
    surfaceDim: "#131318",
    surfaceBright: "#39383e",
    surfaceVariant: "#35343a",
    surfaceContainerLowest: "#0e0e13",
    surfaceContainerLow: "#1b1b20",
    surfaceContainer: "#1f1f24",
    surfaceContainerHigh: "#2a292f",
    surfaceContainerHighest: "#35343a",
    surfaceTint: "#bdc2ff",
    onSurface: "#e4e1e9",
    onSurfaceVariant: "#c6c5d5",
    inverseSurface: "#e4e1e9",
    inverseOnSurface: "#303035",
    outline: "#908f9e",
    outlineVariant: "#454653",

    // Primary
    primary: "#bdc2ff",
    onPrimary: "#131e8c",
    primaryContainer: "#818cf8",
    onPrimaryContainer: "#101b8a",
    primaryFixed: "#e0e0ff",
    primaryFixedDim: "#bdc2ff",
    onPrimaryFixed: "#000767",
    onPrimaryFixedVariant: "#2f3aa3",
    inversePrimary: "#4953bc",

    // Secondary
    secondary: "#c6c7c6",
    onSecondary: "#2f3130",
    secondaryContainer: "#454747",
    onSecondaryContainer: "#b4b5b4",
    secondaryFixed: "#e2e2e2",
    secondaryFixedDim: "#c6c7c6",
    onSecondaryFixed: "#1a1c1c",
    onSecondaryFixedVariant: "#454747",

    // Tertiary
    tertiary: "#ddb8ff",
    onTertiary: "#490081",
    tertiaryContainer: "#b67af1",
    onTertiaryContainer: "#46007b",
    tertiaryFixed: "#f0dbff",
    tertiaryFixedDim: "#ddb8ff",
    onTertiaryFixed: "#2c0051",
    onTertiaryFixedVariant: "#62259b",

    // Error
    error: "#ffb4ab",
    onError: "#690005",
    errorContainer: "#93000a",
    onErrorContainer: "#ffdad6",

    // Glass tokens — design-system.json §elevation
    // Tier 1 (Cards): backdrop-blur 30px, fill 3% white, border 5% white
    glassBorder: "rgba(255,255,255,0.05)",
    glassTint: "rgba(255,255,255,0.03)",
    // Tier 2 (Modals/Overlays): backdrop-blur 50px, fill 6% white
    glassTintStrong: "rgba(255,255,255,0.06)",
  },
  spacing: {
    unit: 8,
    pageMargin: 24,
    gutter: 16,
    cardPadding: 20,
    stackSm: 8,
    stackMd: 16,
    stackLg: 32,
    safeAreaBottom: 34,
  },
  // borderRadius matches design-system.json §rounded scale.
  // `2xl` is a project extension (32px) for "Large cards" per design-system.md §Shapes.
  borderRadius: {
    sm: 4,
    DEFAULT: 8,
    md: 12,
    lg: 16,
    xl: 24,
    "2xl": 32,
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
    labelCaps: {
      fontFamily: "Manrope-SemiBold",
      fontSize: 12,
      lineHeight: 12,
      letterSpacing: 0.1 * 12,
    },
  },
  // From design-system.json §elevation.level2.shadow
  shadows: {
    modal: "0 20px 40px rgba(0,0,0,0.4)",
  },
  // From design-system.json §components.list.ghostOpacity
  opacity: {
    ghost: 0.4,
  },
} as const;

export const lightTheme = {
  ...darkTheme,
  colors: {
    ...darkTheme.colors,
    // Invert background and surface for light theme
    background: "#ffffff",
    surface: "#ffffff",
    onSurface: "#1c1b1f",
    // Invert glass alpha colors to read against light surfaces
    glassBorder: "rgba(0,0,0,0.05)",
    glassTint: "rgba(0,0,0,0.03)",
    glassTintStrong: "rgba(0,0,0,0.06)",
  },
} as const;

export const appThemes = {
  dark: darkTheme,
  light: lightTheme,
} as const;
