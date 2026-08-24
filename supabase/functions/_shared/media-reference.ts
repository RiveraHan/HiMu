export type PrivateMediaKind = "track" | "caption";

const TRACK_KEY =
  /^tracks\/generated\/[A-Za-z0-9._%:-]+\/[A-Za-z0-9._%:-]+\.mp3$/;
const CAPTION_KEY =
  /^captions\/generated\/[A-Za-z0-9._%:-]+\/[A-Za-z0-9._%:-]+\.mp3$/;
const PRIVATE_PREFIX = "r2-private://";

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
