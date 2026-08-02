import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanupQuotaFixtures,
  formatQuotaCheckFailure,
  mergeCheckAndCleanupErrors,
  type QuotaFixtureCleanupAdapter,
} from "./generation-quota-cleanup.ts";

test("cleanup removes dependent rows before DJs and auth users", async () => {
  const calls: string[] = [];
  const adapter: QuotaFixtureCleanupAdapter = {
    async deleteRows(table, column, ids) {
      calls.push(`${table}.${column}:${ids.join(",")}`);
      return null;
    },
    async deleteAuthUser(userId) {
      calls.push(`auth.users.id:${userId}`);
      return null;
    },
  };

  const errors = await cleanupQuotaFixtures(adapter, {
    djIds: ["dj-a", "dj-b"],
    userIds: ["user-a", "user-b"],
  });

  assert.deepEqual(errors, []);
  assert.deepEqual(calls, [
    "generation_jobs.dj_id:dj-a,dj-b",
    "tracks.dj_id:dj-a,dj-b",
    "djs.id:dj-a,dj-b",
    "auth.users.id:user-a",
    "auth.users.id:user-b",
  ]);
});

test("cleanup reports every returned and thrown error without stopping", async () => {
  const calls: string[] = [];
  const adapter: QuotaFixtureCleanupAdapter = {
    async deleteRows(table) {
      calls.push(table);
      if (table === "generation_jobs") return new Error("jobs delete failed");
      if (table === "tracks") throw new Error("tracks delete threw");
      return null;
    },
    async deleteAuthUser(userId) {
      calls.push(`auth:${userId}`);
      return new Error(`auth delete failed: ${userId}`);
    },
  };

  const errors = await cleanupQuotaFixtures(adapter, {
    djIds: ["dj-a"],
    userIds: ["user-a", "user-b"],
  });

  assert.deepEqual(calls, [
    "generation_jobs",
    "tracks",
    "djs",
    "auth:user-a",
    "auth:user-b",
  ]);
  assert.deepEqual(
    errors.map((error) => error.message),
    [
      "cleanup generation_jobs by dj_id failed: jobs delete failed",
      "cleanup tracks by dj_id failed: tracks delete threw",
      "cleanup auth user user-a failed: auth delete failed: user-a",
      "cleanup auth user user-b failed: auth delete failed: user-b",
    ],
  );
});

test("merged failure keeps the check failure and every cleanup failure", () => {
  const checkFailure = new Error("quota assertion failed");
  const cleanupFailures = [
    new Error("jobs cleanup failed"),
    new Error("auth cleanup failed"),
  ];

  const merged = mergeCheckAndCleanupErrors(checkFailure, cleanupFailures);

  assert.ok(merged instanceof AggregateError);
  assert.equal(merged.message, "quota check failed and fixture cleanup also failed");
  assert.equal(merged.cause, checkFailure);
  assert.deepEqual(merged.errors, [checkFailure, ...cleanupFailures]);
});

test("cleanup-only failures remain fatal", () => {
  const cleanupFailure = new Error("cleanup failed");

  const merged = mergeCheckAndCleanupErrors(null, [cleanupFailure]);

  assert.ok(merged instanceof AggregateError);
  assert.equal(merged.message, "quota fixture cleanup failed");
  assert.deepEqual(merged.errors, [cleanupFailure]);
});

test("aggregate failure output includes the check and every cleanup error", () => {
  const merged = mergeCheckAndCleanupErrors(
    new Error("quota assertion failed"),
    [new Error("jobs cleanup failed"), new Error("auth cleanup failed")],
  );

  assert.equal(
    formatQuotaCheckFailure(merged),
    [
      "quota check failed and fixture cleanup also failed",
      "1. quota assertion failed",
      "2. jobs cleanup failed",
      "3. auth cleanup failed",
    ].join("\n"),
  );
});
