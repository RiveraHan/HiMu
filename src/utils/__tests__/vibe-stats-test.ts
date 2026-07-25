import { buildVibeCheck } from "../vibe-stats";

test("builds locale-independent weekday IDs", () => {
  const vibe = buildVibeCheck([], new Date(2026, 6, 22));

  expect(vibe.week.map((point) => point.weekday)).toEqual([
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
    "sun",
  ]);
  expect(vibe.week[0]).not.toHaveProperty("label");
});
