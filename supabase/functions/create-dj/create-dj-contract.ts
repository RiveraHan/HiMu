export const MAX_OWNED_DJS = 1;

export function isDjQuotaError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as Record<string, unknown>;
  return candidate.code === "P0001" && candidate.message === "dj_quota_reached";
}
