import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  const nonce = crypto.randomUUID();
  const userIds: string[] = [];

  try {
    for (const label of ["a", "b"]) {
      const { data, error } = await client.auth.admin.createUser({
        email: `quota-${label}-${nonce}@example.invalid`,
        email_confirm: true,
        user_metadata: { name: `Quota ${label.toUpperCase()}` },
      });
      if (error || !data.user) throw error ?? new Error("could not create user");
      userIds.push(data.user.id);
    }
    const [userA, userB] = userIds;

    const djRows = [
      { id: crypto.randomUUID(), owner_id: userA, label: "a1" },
      { id: crypto.randomUUID(), owner_id: userA, label: "a2" },
      { id: crypto.randomUUID(), owner_id: userB, label: "b1" },
      { id: crypto.randomUUID(), owner_id: userB, label: "b2" },
    ].map((row) => ({
      id: row.id,
      owner_id: row.owner_id,
      name: `Quota DJ ${row.label}`,
      slug: `quota-${row.label}-${nonce}`,
      is_public: false,
    }));
    const { error: djError } = await client.from("djs").insert(djRows);
    if (djError) throw djError;

    const [djA1, djA2, djB1, djB2] = djRows;
    const recent = new Date(Date.now() - 60_000).toISOString();
    const seedJobs = [
      ...Array.from({ length: 9 }, () => ({
        user_id: userA,
        dj_id: djA1.id,
        status: "ready",
        created_at: recent,
        updated_at: recent,
      })),
      ...Array.from({ length: 9 }, () => ({
        user_id: userB,
        dj_id: djB1.id,
        status: "ready",
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
    });
    if (trackError) throw trackError;

    const aDjs = [djA1.id, djA2.id];
    const aRace = await Promise.all(
      aDjs.map((djId) =>
        rpcRow(client, "reserve_manual_generation_job", {
          p_user_id: userA,
          p_dj_id: djId,
          p_prompt: null,
        })
      ),
    );
    assert.deepEqual(
      aRace.map((row) => row.outcome).sort(),
      ["created", "quota"],
    );
    assert.equal(await usage(client, userA), 10);

    const [bManual, bCover] = await Promise.all([
      rpcRow(client, "reserve_manual_generation_job", {
        p_user_id: userB,
        p_dj_id: djB2.id,
        p_prompt: null,
      }),
      rpcRow(client, "reserve_cover_generation", {
        p_user_id: userB,
        p_track_id: trackId,
      }),
    ]);
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
    assert.equal(await usage(client, userB), 10);

    const aWinningDj = aDjs[aRace.findIndex((row) => row.outcome === "created")];
    const aReconnect = await rpcRow(client, "reserve_manual_generation_job", {
      p_user_id: userA,
      p_dj_id: aWinningDj,
      p_prompt: null,
    });
    assert.equal(aReconnect.outcome, "existing");

    console.log("generation quota concurrency checks passed");
  } finally {
    await Promise.allSettled(
      userIds.map((userId) => client.auth.admin.deleteUser(userId)),
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
