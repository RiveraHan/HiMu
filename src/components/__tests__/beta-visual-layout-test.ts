import { resolveBetaVisualLayout } from "../beta-visual-layout";

describe("resolveBetaVisualLayout", () => {
  it.each([
    [767, 600, "compact", false, false, true],
    [768, 600, "medium", false, false, true],
    [1023, 600, "medium", false, false, true],
    [1024, 600, "wide", false, true, false],
    [1024, 599, "wide", true, false, true],
  ] as const)(
    "resolves %i×%i without hiding document-flow actions",
    (width, height, band, lowHeight, supplement, documentFlowActions) => {
      expect(resolveBetaVisualLayout({ width, height })).toEqual({
        band,
        lowHeight,
        showDesktopSupplement: supplement,
        useDocumentFlowActions: documentFlowActions,
      });
    },
  );
});
