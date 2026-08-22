import { HIMU_FONTS } from "@/src/theme/fonts";

describe("HiMu font contract", () => {
  it("registers the bundled Manrope weights used by the semantic theme", () => {
    expect(HIMU_FONTS).toEqual({
      "Manrope-Regular": expect.any(Number),
      "Manrope-SemiBold": expect.any(Number),
      "Manrope-Bold": expect.any(Number),
    });
  });
});
