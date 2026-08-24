import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function objectUrl(accountId: string, bucket: string, key: string): string {
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encoded}`;
}

async function main() {
  if (process.env.ALLOW_REMOTE_SECURITY_CHECK !== "1") {
    throw new Error("set ALLOW_REMOTE_SECURITY_CHECK=1 to run remote fixtures");
  }
  const supabaseUrl = required("EXPO_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const publishableKey = required("EXPO_PUBLIC_SUPABASE_KEY");
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const accountId = required("CLOUDFLARE_ACCOUNT_ID");
  const publicBucket = required("R2_BUCKET");
  const privateBucket = required("R2_PRIVATE_BUCKET");
  const publicBase = required("R2_PUBLIC_BASE").replace(/\/+$/, "");
  assert.notEqual(publicBucket, privateBucket);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const r2 = new AwsClient({
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
  const nonce = crypto.randomUUID();
  const password = `Security-${crypto.randomUUID()}!`;
  const userIds: string[] = [];
  const djId = crypto.randomUUID();
  const trackId = crypto.randomUUID();
  const key = `tracks/generated/${crypto.randomUUID()}/${crypto.randomUUID()}.mp3`;

  try {
    const tokens: string[] = [];
    for (const label of ["owner", "other"]) {
      const email = `private-media-${label}-${nonce}@example.invalid`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error("fixture user creation failed");
      userIds.push(data.user.id);
      const client = createClient(supabaseUrl, publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const session = await client.auth.signInWithPassword({ email, password });
      if (session.error || !session.data.session) {
        throw session.error ?? new Error("fixture sign-in failed");
      }
      tokens.push(session.data.session.access_token);
    }

    const uploaded = await r2.fetch(objectUrl(accountId, privateBucket, key), {
      method: "PUT",
      body: new TextEncoder().encode("ID3 HiMu private media security fixture"),
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-store",
      },
    });
    assert.ok(uploaded.ok, `private fixture upload failed (${uploaded.status})`);

    const { error: djError } = await admin.from("djs").insert({
      id: djId,
      owner_id: userIds[0],
      name: "Private media security fixture",
      slug: `private-media-security-${nonce}`,
      is_public: false,
    });
    if (djError) throw djError;
    const { error: trackError } = await admin.from("tracks").insert({
      id: trackId,
      owner_id: userIds[0],
      dj_id: djId,
      title: "Private media security fixture",
      artist: "HiMu",
      audio_url: `r2-private://${key}`,
      is_public: false,
      is_ai_generated: true,
    });
    if (trackError) throw trackError;

    const invoke = (token?: string) => fetch(`${supabaseUrl}/functions/v1/private-media-url`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ kind: "track", trackId }),
    });

    const unauthenticated = await invoke();
    assert.equal(unauthenticated.status, 401);
    const crossTenant = await invoke(tokens[1]);
    assert.equal(crossTenant.status, 403);
    const owner = await invoke(tokens[0]);
    assert.equal(owner.status, 200);
    const ownerBody = await owner.json() as { url?: unknown; expiresIn?: unknown };
    assert.equal(ownerBody.expiresIn, 300);
    assert.equal(typeof ownerBody.url, "string");
    const signedUrl = new URL(ownerBody.url as string);
    assert.equal(signedUrl.protocol, "https:");
    assert.ok(signedUrl.hostname.endsWith(".r2.cloudflarestorage.com"));
    assert.equal(signedUrl.searchParams.get("X-Amz-Expires"), "300");

    const privateDownload = await fetch(signedUrl);
    assert.equal(privateDownload.status, 200);
    assert.equal(privateDownload.headers.get("cache-control"), "private, no-store");
    const publicAttempt = await fetch(`${publicBase}/${key}`);
    assert.notEqual(publicAttempt.status, 200);

    console.log(JSON.stringify({
      unauthenticated: unauthenticated.status,
      crossTenant: crossTenant.status,
      owner: owner.status,
      signedDownload: privateDownload.status,
      signedExpirySeconds: ownerBody.expiresIn,
      publicAttempt: publicAttempt.status,
    }));
  } finally {
    const cleanup = await r2.fetch(objectUrl(accountId, privateBucket, key), {
      method: "DELETE",
    }).catch(() => null);
    if (cleanup && !cleanup.ok && cleanup.status !== 404) {
      console.error("private media fixture object cleanup failed");
    }
    await admin.from("tracks").delete().eq("id", trackId);
    await admin.from("djs").delete().eq("id", djId);
    for (const userId of userIds) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) console.error("private media fixture user cleanup failed");
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "private media e2e failed");
  process.exitCode = 1;
});
