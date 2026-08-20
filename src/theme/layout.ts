import { layoutBreakpoints } from "./breakpoints";

export type LayoutMode = "compact" | "medium" | "desktop";

export const canvasMaxWidth = {
  readable: 720,
  wide: 1120,
  max: 1280,
} as const;

export function resolveLayoutMode(width: number): LayoutMode {
  if (width >= layoutBreakpoints.desktop) return "desktop";
  if (width >= layoutBreakpoints.medium) return "medium";
  return "compact";
}
