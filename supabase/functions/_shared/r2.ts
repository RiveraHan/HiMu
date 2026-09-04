import { AwsClient } from "npm:aws4fetch";
import {
  parseGeneratedPublicKey,
  parseOwnedTrackPromotion,
  parsePrivateMediaReference,
  trackMomentPublicKey,
} from "./media-reference.ts";
import {
  storageTarget,
  type R2Access,
  type R2Environment,
} from "./r2-contract.ts";

const ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID")!;
const R2_BUCKET = Deno.env.get("R2_BUCKET")!;
// Supabase's connector can deploy functions but cannot provision project
// secrets. Keep production available with a distinct, private-by-convention
// bucket while still allowing an explicit deployment override.
const R2_PRIVATE_BUCKET =
  Deno.env.get("R2_PRIVATE_BUCKET")?.trim() || `${R2_BUCKET}-private`;

export const R2_PUBLIC_BASE = (Deno.env.get("R2_PUBLIC_BASE") ?? "").replace(
  /\/+$/,
  "",
);

const r2 = new AwsClient({
  accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
  secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
  service: "s3",
  region: "auto",
});

const environment: R2Environment = {
  accountId: ACCOUNT_ID,
  publicBucket: R2_BUCKET,
  privateBucket: R2_PRIVATE_BUCKET,
  publicBase: R2_PUBLIC_BASE,
};

export async function r2Put(
  key: string,
  bytes: Uint8Array,
  contentType: string,
  access: R2Access,
): Promise<string> {
  const target = storageTarget(access, key, environment);
  const response = await r2.fetch(target.objectUrl, {
    method: "PUT",
    body: bytes,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": access === "private"
        ? "private, no-store"
        : "public, max-age=300",
    },
  });
  if (!response.ok) throw new Error(`R2 PUT (${response.status})`);
  return target.reference;
}

export async function r2Delete(
  keys: string[],
  access: R2Access,
): Promise<void> {
  const del = (key: string) =>
    r2.fetch(storageTarget(access, key, environment).objectUrl, {
      method: "DELETE",
    });

  const results = await Promise.allSettled(
    keys.map(async (key) => {
      let res = await del(key);
      if (!res.ok && res.status !== 404) res = await del(key); // retry once
      if (!res.ok && res.status !== 404)
        throw new Error(`R2 DELETE ${key} (${res.status})`);
    }),
  );

  for (const r of results) {
    if (r.status === "rejected") console.error("[r2Delete]", r.reason);
  }
}

// Only our own generated assets are ever deletable.
const GENERATED_KEY_RE = /^(tracks|captions|covers|avatars)\/generated\//;

export function keyFromPublicUrl(url: string): string | null {
  if (!R2_PUBLIC_BASE || !url.startsWith(`${R2_PUBLIC_BASE}/`)) return null;
  const key = url.slice(R2_PUBLIC_BASE.length + 1);
  return GENERATED_KEY_RE.test(key) ? key : null;
}

export function keyFromStoredMedia(
  value: string,
): { key: string; access: R2Access } | null {
  const privateTrack = parsePrivateMediaReference(value, "track");
  if (privateTrack) return { key: privateTrack.key, access: "private" };
  const privateCaption = parsePrivateMediaReference(value, "caption");
  if (privateCaption) return { key: privateCaption.key, access: "private" };
  const publicKey = keyFromPublicUrl(value);
  return publicKey ? { key: publicKey, access: "public" } : null;
}

export async function r2PresignPrivateGet(
  key: string,
  expiresSeconds = 300,
): Promise<string> {
  const expires = Math.min(300, Math.max(60, Math.trunc(expiresSeconds)));
  const target = storageTarget("private", key, environment);
  const url = new URL(target.objectUrl);
  url.searchParams.set("X-Amz-Expires", String(expires));
  const signed = await r2.sign(url.toString(), {
    method: "GET",
    aws: { signQuery: true },
  });
  return signed.url.toString();
}

export type TrackPromotionObject = Readonly<{
  operationToken: string;
  sourceKey: string;
  publicKey: string;
  publicRef: string;
  contentLength: number;
}>;

function encodedKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

async function r2Head(key: string, access: R2Access): Promise<Response> {
  return r2.fetch(storageTarget(access, key, environment).objectUrl, {
    method: "HEAD",
  });
}

export async function r2CopyPrivateGeneratedTrack(
  privateReference: string,
  operationToken: string,
): Promise<TrackPromotionObject> {
  const source = parsePrivateMediaReference(privateReference, "track");
  const publicKey = trackMomentPublicKey(privateReference, operationToken);
  if (!source || !publicKey) throw new Error("invalid track promotion source");

  const sourceHead = await r2Head(source.key, "private");
  const rawLength = sourceHead.headers.get("content-length");
  const contentLength = rawLength === null ? NaN : Number(rawLength);
  if (!sourceHead.ok || !Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throw new Error("private track source unavailable");
  }

  const target = storageTarget("public", publicKey, environment);
  const copied = await r2.fetch(target.objectUrl, {
    method: "PUT",
    headers: {
      "x-amz-copy-source": `/${encodeURIComponent(R2_PRIVATE_BUCKET)}/${encodedKey(source.key)}`,
      "x-amz-metadata-directive": "REPLACE",
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=300",
    },
  });
  if (!copied.ok) throw new Error(`R2 track copy (${copied.status})`);
  return {
    operationToken,
    sourceKey: source.key,
    publicKey,
    publicRef: target.reference,
    contentLength,
  };
}

export async function r2VerifyPublicGeneratedTrack(
  promotion: TrackPromotionObject,
): Promise<boolean> {
  const parsed = parseOwnedTrackPromotion(
    promotion.publicRef,
    R2_PUBLIC_BASE,
    promotion.operationToken,
  );
  if (!parsed || parsed.key !== promotion.publicKey) return false;
  const response = await r2Head(parsed.key, "public");
  const rawLength = response.headers.get("content-length");
  const contentLength = rawLength === null ? NaN : Number(rawLength);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return response.ok && contentLength === promotion.contentLength &&
    contentLength > 0 && contentType.startsWith("audio/");
}

export async function r2DeleteOwnedTrackPromotion(
  promotion: TrackPromotionObject,
): Promise<void> {
  const parsed = parseOwnedTrackPromotion(
    promotion.publicRef,
    R2_PUBLIC_BASE,
    promotion.operationToken,
  );
  if (!parsed || parsed.key !== promotion.publicKey) {
    throw new Error("invalid owned track promotion");
  }
  await r2Delete([parsed.key], "public");
}

export async function r2DeleteValidatedPublicTrack(
  publicReference: string,
  publicObjectKey: string,
): Promise<void> {
  const parsed = parseGeneratedPublicKey(publicReference, R2_PUBLIC_BASE);
  if (!parsed || parsed.kind !== "track" || parsed.key !== publicObjectKey) {
    throw new Error("invalid public track cleanup target");
  }
  await r2Delete([parsed.key], "public");
}

export type { R2Access } from "./r2-contract.ts";
