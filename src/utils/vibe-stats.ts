export type ListeningRow = {
  date: string;
  minutes_listened: number | null;
  tracks_played: number | null;
  top_genre: string | null;
};

export type DayPoint = {
  label: string; // day of the week
  date: string; // YYYY-MM-DD
  minutes: number;
  isToday: boolean;
};

export type GenreSlice = { genre: string; percentage: number };

export type VibeCheck = {
  week: DayPoint[];
  hoursThisWeek: number;
  tracksThisWeek: number;
  streak: number; // consecutive days listening > 0 minutes today/yesterday
  topGenre: string | null;
  genreMix: GenreSlice[];
  weekOverWeekPct: number | null; // delta vs last week
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function midnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, n: number): Date {
  const r = midnight(date);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeekMonday(today: Date): Date {
  const d = midnight(today);
  const dow = (d.getDay() + 6) % 7; // 0=Mon … 6=Sun
  return addDays(d, -dow);
}

export function buildVibeCheck(
  rows: ListeningRow[],
  now: Date = new Date(),
): VibeCheck {
  const byDate = new Map<string, ListeningRow>();

  for (const row of rows) if (row.date) byDate.set(row.date, row);

  const todayISO = toISODate(now);
  const weekStart = startOfWeekMonday(now);

  const week: DayPoint[] = Array.from({ length: 7 }, (_, i) => {
    const iso = toISODate(addDays(weekStart, i));

    return {
      label: DAY_LABELS[i],
      date: iso,
      minutes: byDate.get(iso)?.minutes_listened ?? 0,
      isToday: iso === todayISO,
    };
  });

  const minutesThisWeek = week.reduce((sum, p) => sum + p.minutes, 0);
  const tracksThisWeek = week.reduce(
    (sum, p) => sum + (byDate.get(p.date)?.tracks_played ?? 0),
    0,
  );

  // Mix genres on week
  const genreDays = new Map<string, number>();
  for (const p of week) {
    const g = byDate.get(p.date)?.top_genre;
    if (g) genreDays.set(g, (genreDays.get(g) ?? 0) + 1);
  }

  const totalGenreDays = [...genreDays.values()].reduce((sum, n) => sum + n, 0);

  const genreMix: GenreSlice[] = [...genreDays.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre, days]) => ({
      genre,
      percentage: totalGenreDays ? days / totalGenreDays : 0,
    }));

  const active = (date: Date) =>
    (byDate.get(toISODate(date))?.minutes_listened ?? 0) > 0;
  let cursor = midnight(now);
  if (!active(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (active(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  const lastWeekStart = addDays(weekStart, -7);
  let lastWeekMinutes = 0;
  for (let i = 0; i < 7; i++) {
    lastWeekMinutes +=
      byDate.get(toISODate(addDays(lastWeekStart, i)))?.minutes_listened ?? 0;
  }
  const weekOverWeekPct =
    lastWeekMinutes > 0
      ? (minutesThisWeek - lastWeekMinutes) / lastWeekMinutes
      : null;

  return {
    week,
    hoursThisWeek: minutesThisWeek / 60,
    tracksThisWeek,
    streak,
    topGenre: genreMix[0]?.genre ?? null,
    genreMix,
    weekOverWeekPct,
  };
}
