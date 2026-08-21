// Mobile-first breakpoints.
// sm: iPhone SE width, md: iPhone Pro width, lg: iPad portrait, xl: desktop,
// xxl: wide desktop.
export const breakpoints = {
  xs: 0,
  sm: 320,
  md: 390,
  lg: 768,
  xl: 1024,
  xxl: 1440,
} as const;

export const layoutBreakpoints = {
  medium: breakpoints.lg,
  desktop: breakpoints.xl,
} as const;
