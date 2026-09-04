const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROOT_HTTPS_ORIGIN_PATTERN = /^https:\/\/[^\s/?#@\\]+\/?$/i;

export function publicTrackMomentUrl(
  origin: string | undefined,
  trackId: string,
): string | null {
  if (!origin || !UUID_PATTERN.test(trackId)) return null;

  const candidate = origin.trim();
  if (candidate !== origin) return null;
  if (!ROOT_HTTPS_ORIGIN_PATTERN.test(candidate)) return null;

  try {
    const parsed = new URL(candidate);
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }

    parsed.hostname = parsed.hostname.toLowerCase();
    return `${parsed.origin}/track/${trackId.toLowerCase()}`;
  } catch {
    return null;
  }
}
