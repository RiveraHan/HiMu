const numberFormatter = (value: number, language: string) =>
  new Intl.NumberFormat(language, {
    maximumFractionDigits: 1,
    notation: value >= 1000 ? "compact" : "standard",
  });

export const formatCount = (value: number, language: string): string =>
  numberFormatter(value, language).format(value);

export const formatHours = (value: number, language: string): string =>
  numberFormatter(value, language).format(value);
