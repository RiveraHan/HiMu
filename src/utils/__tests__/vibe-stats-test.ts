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

test("includes UTC Monday activity while the listener is still on local Sunday", () => {
  const vibe = buildVibeCheck([
    { date: "2026-09-14", minutes_listened: 60, tracks_played: 2, top_genre: "Soul" },
  ], new Date("2026-09-13T19:30:00-06:00"));

  expect(vibe.week[0]).toEqual({
    weekday: "mon", date: "2026-09-14", minutes: 60, isToday: true,
  });
  expect(vibe.hoursThisWeek).toBe(1);
  expect(vibe.tracksThisWeek).toBe(2);
  expect(vibe.streak).toBe(1);
});
