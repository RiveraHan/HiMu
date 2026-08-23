import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Credentials = { apiUrl: string; serviceRoleKey: string; remote: boolean };

function localCredentials(): Credentials {
  const output = execFileSync(
    "npx",
    ["supabase", "status", "-o", "env"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const values = new Map<string, string>();
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(?:"([^"]*)"|'([^']*)'|(.*))$/);
    if (match) values.set(match[1], match[2] ?? match[3] ?? match[4] ?? "");
  }
  const apiUrl = values.get("API_URL");
  const serviceRoleKey = values.get("SERVICE_ROLE_KEY");
  if (!apiUrl || !serviceRoleKey) {
    throw new Error("local Supabase status omitted API_URL or SERVICE_ROLE_KEY");
  }
  return { apiUrl, serviceRoleKey, remote: false };
}

function credentials(): Credentials {
  const apiUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiUrl && !serviceRoleKey) return localCredentials();
  if (!apiUrl || !serviceRoleKey) {
    throw new Error("remote security check credentials are incomplete");
  }
  if (process.env.ALLOW_REMOTE_SECURITY_CHECK !== "1") {
    throw new Error("set ALLOW_REMOTE_SECURITY_CHECK=1 to run fixtures remotely");
  }
  return { apiUrl, serviceRoleKey, remote: true };
}

async function rpcRow(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  assert.ok(Array.isArray(data) && data.length === 1, `${name} must return one row`);
  return data[0] as Record<string, unknown>;
}

async function insertDj(
  client: SupabaseClient,
  userId: string,
  nonce: string,
  label: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await client.from("djs").insert({
    id,
    owner_id: userId,
    name: `Security fixture ${label}`,
    slug: `security-${label}-${nonce}`,
    is_public: false,
  });
  if (error) throw error;
  return id;
}

const brief = {
  version: 1,
  title: "Security fixture",
  creativeDirection: "A deliberately minimal database admission fixture.",
  mode: "instrumental",
  lyricTheme: "",
  lyrics: "",
  visibility: "private",
  traitSnapshot: {
    genres: ["Ambient"],
    moods: ["Calm"],
    energy: 3,
    vibe: "quiet",
    identityConcept: "A quiet selector used only for a security invariant check.",
  },
};

async function reserveManual(
  client: SupabaseClient,
  userId: string,
  djId: string,
) {
  return await rpcRow(client, "reserve_manual_generation_job", {
    p_user_id: userId,
    p_dj_id: djId,
    p_generation_brief: brief,
    p_is_public: false,
    p_source_track_id: null,
  });
}

async function main() {
  const { apiUrl, serviceRoleKey, remote } = credentials();
  const client = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const nonce = crypto.randomUUID();
  const userIds: string[] = [];
  const djIds: string[] = [];

  try {
    for (const label of ["a", "b"]) {
      const { data, error } = await client.auth.admin.createUser({
        email: `security-${label}-${nonce}@example.invalid`,
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error("could not create fixture user");
      userIds.push(data.user.id);
    }
    const [userA, userB] = userIds;

    let djA = await insertDj(client, userA, nonce, "a-first");
    djIds.push(djA);
    const djB = await insertDj(client, userB, nonce, "b");
    djIds.push(djB);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const reservation = await reserveManual(client, userA, djA);
      assert.equal(reservation.outcome, "created");
      const { error } = await client
        .from("generation_jobs")
        .update({ status: "failed", error: "security_fixture" })
        .eq("id", reservation.job_id as string);
      if (error) throw error;
    }

    const { error: firstDeleteError } = await client.from("djs").delete().eq("id", djA);
    if (firstDeleteError) throw firstDeleteError;
    djA = await insertDj(client, userA, nonce, "a-replacement");
    djIds.push(djA);
    const afterDelete = await reserveManual(client, userA, djA);
    assert.equal(afterDelete.outcome, "quota");
    assert.equal(afterDelete.daily_limit, 3);

    const separateUser = await reserveManual(client, userB, djB);
    assert.equal(separateUser.outcome, "created");

    const daily = await Promise.all(
      ["2025-01-01", "2026-08-23", "2099-12-31"].map((dropDate) =>
        rpcRow(client, "reserve_daily_generation_job", {
          p_user_id: userA,
          p_dj_id: djA,
          p_drop_date: dropDate,
        })
      ),
    );
    assert.equal(daily.filter((row) => row.outcome === "created").length, 1);
    assert.equal(daily.filter((row) => row.outcome === "existing").length, 2);
    assert.equal(new Set(daily.map((row) => row.job_id)).size, 1);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const avatar = await rpcRow(client, "reserve_avatar_generation", {
        p_user_id: userA,
        p_operation: "avatar_regen",
        p_request_id: crypto.randomUUID(),
      });
      assert.equal(avatar.outcome, "created");
    }
    const { error: replacementDeleteError } = await client
      .from("djs")
      .delete()
      .eq("id", djA);
    if (replacementDeleteError) throw replacementDeleteError;
    djA = await insertDj(client, userA, nonce, "a-final");
    djIds.push(djA);
    const initialAfterDelete = await rpcRow(client, "reserve_avatar_generation", {
      p_user_id: userA,
      p_operation: "initial_avatar",
      p_request_id: crypto.randomUUID(),
    });
    assert.equal(initialAfterDelete.outcome, "quota");

    const draftRequestIds = Array.from({ length: 40 }, () => crypto.randomUUID());
    const drafts = await Promise.all(
      draftRequestIds.map((requestId) =>
        rpcRow(client, "reserve_creative_draft", {
          p_user_id: userB,
          p_kind: "dj-identity",
          p_request_id: requestId,
        })
      ),
    );
    assert.equal(drafts.filter((row) => row.outcome === "created").length, 30);
    assert.equal(drafts.filter((row) => row.outcome === "quota").length, 10);
    const retry = await rpcRow(client, "reserve_creative_draft", {
      p_user_id: userB,
      p_kind: "dj-identity",
      p_request_id: draftRequestIds[0],
    });
    assert.equal(retry.outcome, "existing");

    const isolatedDraft = await rpcRow(client, "reserve_creative_draft", {
      p_user_id: userA,
      p_kind: "dj-identity",
      p_request_id: crypto.randomUUID(),
    });
    assert.equal(isolatedDraft.outcome, "created");

    console.log(JSON.stringify({
      target: remote ? "remote" : "local",
      daily: { created: 1, existing: 2 },
      generationAfterDjDelete: "quota",
      avatarAfterDjDelete: "quota",
      drafts: { created: 30, quota: 10, retry: "existing" },
      tenantIsolation: "passed",
    }));
  } finally {
    if (djIds.length > 0) {
      const { error } = await client.from("djs").delete().in("id", djIds);
      if (error) console.error("security fixture DJ cleanup failed");
    }
    for (const userId of userIds) {
      const { error } = await client.auth.admin.deleteUser(userId);
      if (error) console.error("security fixture user cleanup failed");
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "security quota invariant failed");
  process.exitCode = 1;
});
