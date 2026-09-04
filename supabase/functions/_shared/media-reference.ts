export type PrivateMediaKind = "track" | "caption";

const TRACK_KEY =
  /^tracks\/generated\/[A-Za-z0-9._%:-]+\/[A-Za-z0-9._%:-]+\.mp3$/;
const CAPTION_KEY =
  /^captions\/generated\/[A-Za-z0-9._%:-]+\/[A-Za-z0-9._%:-]+\.mp3$/;
const PRIVATE_PREFIX = "r2-private://";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generatedKind(key: string): PrivateMediaKind | null {
  if (
    key.length === 0 || /[\u0000-\u001f\u007f]/.test(key) ||
    key.includes("\\") || key.includes("?") || key.includes("#") ||
    key.includes("..") || /%(?:2e|2f|5c)/i.test(key)
  ) {
    return null;
  }
  if (TRACK_KEY.test(key)) return "track";
  if (CAPTION_KEY.test(key)) return "caption";
  return null;
}

export function privateMediaReference(key: string): string {
  if (!generatedKind(key)) throw new Error("invalid private media key");
  return `${PRIVATE_PREFIX}${key}`;
}

export function parsePrivateMediaReference(
  value: unknown,
  expectedKind: PrivateMediaKind,
): { key: string; kind: PrivateMediaKind } | null {
  if (typeof value !== "string" || !value.startsWith(PRIVATE_PREFIX)) {
    return null;
  }
  const key = value.slice(PRIVATE_PREFIX.length);
  const kind = generatedKind(key);
  return kind === expectedKind ? { key, kind } : null;
}

export function parseGeneratedPublicKey(
  value: unknown,
  publicBase: string,
): { key: string; kind: PrivateMediaKind } | null {
  if (typeof value !== "string" || publicBase.length === 0) return null;
  const base = publicBase.replace(/\/+$/, "");
  if (!value.startsWith(`${base}/`)) return null;
  const key = value.slice(base.length + 1);
  const kind = generatedKind(key);
  return kind ? { key, kind } : null;
}

export function safePublicHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export function trackMomentPublicKey(
  privateReference: unknown,
  operationToken: unknown,
): string | null {
  const parsed = parsePrivateMediaReference(privateReference, "track");
  if (!parsed || typeof operationToken !== "string" || !UUID.test(operationToken)) {
    return null;
  }
  return `${parsed.key.slice(0, -4)}.moment-${operationToken.toLowerCase()}.mp3`;
}

export function parseOwnedTrackPromotion(
  publicReference: unknown,
  publicBase: string,
  operationToken: unknown,
): { key: string; kind: "track" } | null {
  if (typeof operationToken !== "string" || !UUID.test(operationToken)) return null;
  const parsed = parseGeneratedPublicKey(publicReference, publicBase);
  if (
    !parsed || parsed.kind !== "track" ||
    !parsed.key.endsWith(`.moment-${operationToken.toLowerCase()}.mp3`)
  ) {
    return null;
  }
  return { key: parsed.key, kind: "track" };
}
