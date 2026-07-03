import { AwsClient } from "npm:aws4fetch";

const ACCOUNT_ID = Deno.env.get("CLOUDFLARE_ACCOUNT_ID")!;
const R2_BUCKET = Deno.env.get("R2_BUCKET")!;

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

const objectUrl = (key: string) =>
  `https://${ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;

export async function r2Put(
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const r = await r2.fetch(objectUrl(key), {
    method: "PUT",
    body: bytes,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
    },
  });
  if (!r.ok) throw new Error(`R2 PUT (${r.status})`);
  return `${R2_PUBLIC_BASE}/${key}`;
}

export async function r2Delete(keys: string[]): Promise<void> {
  const del = (key: string) =>
    r2.fetch(objectUrl(key), {
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
const GENERATED_KEY_RE = /^(tracks|covers|avatars)\/generated\//;

export function keyFromPublicUrl(url: string): string | null {
  if (!R2_PUBLIC_BASE || !url.startsWith(`${R2_PUBLIC_BASE}/`)) return null;
  const key = url.slice(R2_PUBLIC_BASE.length + 1);
  return GENERATED_KEY_RE.test(key) ? key : null;
}
