export const formatCount = (value: number): string =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    : value >= 1000
      ? `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`
      : String(Math.round(value));

export const formatHours = (hour: number): string =>
  hour >= 1000
    ? formatCount(hour)
    : hour >= 10
      ? String(Math.round(hour))
      : hour.toFixed(1);
