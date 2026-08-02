import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  cleanupQuotaFixtures,
  formatQuotaCheckFailure,
  mergeCheckAndCleanupErrors,
} from "./generation-quota-cleanup.ts";

function localCredentials(): { apiUrl: string; serviceRoleKey: string } {
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
  return { apiUrl, serviceRoleKey };
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

async function usage(client: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await client.rpc("generation_quota_usage", {
    p_user_id: userId,
    p_at: new Date().toISOString(),
  });
  if (error) throw error;
  assert.equal(typeof data, "number");
  return data;
}

async function main() {
  const { apiUrl, serviceRoleKey } = localCredentials();
  const client = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const raceClient = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const nonce = crypto.randomUUID();
  const userIds: string[] = [];
  const djIds: string[] = [];

  let checkFailure: unknown | null = null;
  try {
    for (const label of ["a", "b", "c"]) {
      const { data, error } = await client.auth.admin.createUser({
        email: `quota-${label}-${nonce}@example.invalid`,
        email_confirm: true,
        user_metadata: { name: `Quota ${label.toUpperCase()}` },
      });
      if (error || !data.user) throw error ?? new Error("could not create user");
      userIds.push(data.user.id);
    }
    const [userA, userB, userC] = userIds;

    const cDjRows = ["first", "second"].map((label) => ({
      id: crypto.randomUUID(),
      owner_id: userC,
      name: `Quota DJ c ${label}`,
      slug: `quota-c-${label}-${nonce}`,
      is_public: false,
    }));
    djIds.push(...cDjRows.map((row) => row.id));
    const cRace = await Promise.all([
      client.from("djs").insert(cDjRows[0]),
      raceClient.from("djs").insert(cDjRows[1]),
    ]);
    assert.equal(cRace.filter(({ error }) => error === null).length, 1);
    const cLoser = cRace.find(({ error }) => error !== null);
    assert.equal(cLoser?.error?.code, "P0001");
    assert.equal(cLoser?.error?.message, "dj_quota_reached");

    const { count: cDjCount, error: cDjCountError } = await client
      .from("djs")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userC);
    if (cDjCountError) throw cDjCountError;
    assert.equal(cDjCount, 1);

    const djRows = [
      { id: crypto.randomUUID(), owner_id: userA, label: "a1" },
      { id: crypto.randomUUID(), owner_id: null, label: "a2" },
      { id: crypto.randomUUID(), owner_id: userB, label: "b1" },
      { id: crypto.randomUUID(), owner_id: null, label: "b2" },
    ].map((row) => ({
      id: row.id,
      owner_id: row.owner_id,
      name: `Quota DJ ${row.label}`,
      slug: `quota-${row.label}-${nonce}`,
      is_public: false,
    }));
    djIds.push(...djRows.map((row) => row.id));
    const { error: djError } = await client.from("djs").insert(djRows);
    if (djError) throw djError;

    const [djA1, djA2, djB1, djB2] = djRows;
    const recent = new Date(Date.now() - 60_000).toISOString();
    const seedJobs = [
      ...Array.from({ length: 2 }, () => ({
        user_id: userA,
        dj_id: djA1.id,
        status: "ready",
        is_public: false,
        created_at: recent,
        updated_at: recent,
      })),
      ...Array.from({ length: 2 }, () => ({
        user_id: userB,
        dj_id: djB1.id,
        status: "ready",
        is_public: false,
        created_at: recent,
        updated_at: recent,
      })),
    ];
    const { error: seedError } = await client
      .from("generation_jobs")
      .insert(seedJobs);
    if (seedError) throw seedError;

    const trackId = crypto.randomUUID();
    const { error: trackError } = await client.from("tracks").insert({
      id: trackId,
      title: "Quota race track",
      artist: "Quota DJ b1",
      dj_id: djB1.id,
      owner_id: userB,
      is_public: false,
    });
    if (trackError) throw trackError;

    const aRequests = [
      { djId: djA1.id, isPublic: true },
      { djId: djA2.id, isPublic: false },
    ];
    const aRace = await Promise.all(
      aRequests.map(({ djId, isPublic }) =>
        rpcRow(client, "reserve_manual_generation_job", {
          p_user_id: userA,
          p_dj_id: djId,
          p_prompt: null,
          p_is_public: isPublic,
        })
      ),
    );
    assert.deepEqual(
      aRace.map((row) => row.outcome).sort(),
      ["created", "quota"],
    );
    for (const row of aRace) assert.equal(row.daily_limit, 3);
    const aQuota = aRace.find((row) => row.outcome === "quota");
    assert.deepEqual(aQuota, {
      outcome: "quota",
      job_id: null,
      daily_limit: 3,
      queued_at: null,
      is_public: null,
    });
    assert.equal(await usage(client, userA), 3);

    const [bManual, bCover] = await Promise.all([
      rpcRow(client, "reserve_manual_generation_job", {
        p_user_id: userB,
        p_dj_id: djB2.id,
        p_prompt: null,
        p_is_public: true,
      }),
      rpcRow(client, "reserve_cover_generation", {
        p_user_id: userB,
        p_track_id: trackId,
      }),
    ]);
    assert.equal(bManual.daily_limit, 3);
    assert.equal(bCover.daily_limit, 3);
    assert.equal(
      [bManual.outcome, bCover.outcome].filter((outcome) =>
        outcome === "created" || outcome === "reserved"
      ).length,
      1,
    );
    assert.equal(
      [bManual.outcome, bCover.outcome].filter((outcome) => outcome === "quota")
        .length,
      1,
    );
    assert.equal(await usage(client, userB), 3);

    const aWinningIndex = aRace.findIndex((row) => row.outcome === "created");
    const aWinner = aRace[aWinningIndex];
    const aWinningRequest = aRequests[aWinningIndex];
    assert.equal(aWinner.is_public, aWinningRequest.isPublic);
    assert.equal(typeof aWinner.queued_at, "string");
    const aReconnect = await rpcRow(client, "reserve_manual_generation_job", {
      p_user_id: userA,
      p_dj_id: aWinningRequest.djId,
      p_prompt: null,
      p_is_public: !aWinningRequest.isPublic,
    });
    assert.equal(aReconnect.outcome, "existing");
    assert.equal(aReconnect.job_id, aWinner.job_id);
    assert.equal(aReconnect.queued_at, aWinner.queued_at);
    assert.equal(aReconnect.daily_limit, 3);
    assert.equal(aReconnect.is_public, aWinningRequest.isPublic);

    console.log("generation quota concurrency checks passed");
  } catch (error) {
    checkFailure = error;
  }

  const cleanupFailures = await cleanupQuotaFixtures(
    {
      async deleteRows(table, column, ids) {
        const { error } = await client.from(table).delete().in(column, ids);
        return error;
      },
      async deleteAuthUser(userId) {
        const { error } = await client.auth.admin.deleteUser(userId);
        return error;
      },
    },
    { djIds, userIds },
  );
  const failure = mergeCheckAndCleanupErrors(checkFailure, cleanupFailures);
  if (failure !== null) {
    throw failure;
  }
}

main().catch((error) => {
  console.error(formatQuotaCheckFailure(error));
  process.exitCode = 1;
});
