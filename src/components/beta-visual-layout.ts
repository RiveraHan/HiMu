import { resolveLayoutMode } from "@/src/theme/layout";

export type BetaVisualLayout = Readonly<{
  band: "compact" | "medium" | "wide";
  lowHeight: boolean;
  showDesktopSupplement: boolean;
  useDocumentFlowActions: boolean;
}>;

export function resolveBetaVisualLayout({
  width,
  height,
}: Readonly<{
  width: number;
  height: number;
}>): BetaVisualLayout {
  const layoutMode = resolveLayoutMode(width);
  const band = layoutMode === "desktop" ? "wide" : layoutMode;
  const lowHeight = height < 600;

  return {
    band,
    lowHeight,
    showDesktopSupplement: band === "wide" && !lowHeight,
    useDocumentFlowActions: band !== "wide" || lowHeight,
  };
}
