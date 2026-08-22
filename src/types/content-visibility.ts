export type Visibility = "private" | "public";

export const DEFAULT_VISIBILITY: Visibility = "private";

export const visibilityToIsPublic = (value: Visibility) => value === "public";

export const visibilityFromIsPublic = (value: boolean): Visibility =>
  value ? "public" : "private";
