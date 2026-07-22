import { formatCount, formatHours } from "../format-stats";

describe("localized stat formatting", () => {
  it("formats fractional hours with the selected locale", () => {
    expect(formatHours(1.5, "en")).toBe("1.5");
    expect(formatHours(1.5, "es")).toBe("1,5");
  });

  it("formats large counts with locale-aware compact notation", () => {
    expect(formatCount(1500, "en")).toBe("1.5K");
    expect(formatCount(1500, "es")).toBe("1,5\u00a0mil");
  });
});
