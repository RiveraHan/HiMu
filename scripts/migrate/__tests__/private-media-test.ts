import { migratePrivateMediaRows } from "../private-media";

const publicBase = "https://media.example";
const key = "tracks/generated/job-1/attempt.mp3";
const row = {
  kind: "track" as const,
  id: "11111111-1111-4111-8111-111111111111",
  audioRef: `${publicBase}/${key}`,
};

function dependencies(overrides: Record<string, unknown> = {}) {
  const events: string[] = [];
  return {
    events,
    deps: {
      copyToPrivate: async (objectKey: string) => {
        events.push(`copy:${objectKey}`);
        return { contentLength: 3, etag: "etag" };
      },
      verifyPrivate: async (objectKey: string) => {
        events.push(`verify:${objectKey}`);
        return { contentLength: 3, etag: "etag" };
      },
      updateReference: async (mediaRow: typeof row, reference: string) => {
        events.push(`update:${mediaRow.id}:${reference}`);
        return true;
      },
      deletePublic: async (objectKey: string) => {
        events.push(`delete-public:${objectKey}`);
      },
      ...overrides,
    },
  };
}

test("copies, verifies, conditionally updates, then deletes the public source", async () => {
  const { deps, events } = dependencies();
  await expect(migratePrivateMediaRows([row], deps, { publicBase })).resolves.toEqual({
    scanned: 1,
    migrated: 1,
    skipped: 0,
    failed: 0,
    remaining: 0,
  });
  expect(events).toEqual([
    `copy:${key}`,
    `verify:${key}`,
    `update:${row.id}:r2-private://${key}`,
    `delete-public:${key}`,
  ]);
});

test("dry run reports remaining rows without mutations", async () => {
  const { deps, events } = dependencies();
  await expect(migratePrivateMediaRows([row], deps, {
    publicBase,
    dryRun: true,
  })).resolves.toEqual({
    scanned: 1,
    migrated: 0,
    skipped: 0,
    failed: 0,
    remaining: 1,
  });
  expect(events).toEqual([]);
});

test("copy or verification failure preserves the database and source", async () => {
  const copy = dependencies({
    copyToPrivate: async () => {
      throw new Error("copy failed");
    },
  });
  expect((await migratePrivateMediaRows([row], copy.deps, { publicBase })).failed).toBe(1);
  expect(copy.events).toEqual([]);

  const verify = dependencies({
    verifyPrivate: async (objectKey: string) => {
      verify.events.push(`verify:${objectKey}`);
      return { contentLength: 99, etag: "other" };
    },
  });
  expect((await migratePrivateMediaRows([row], verify.deps, { publicBase })).failed).toBe(1);
  expect(verify.events).toEqual([`copy:${key}`, `verify:${key}`]);
});

test("a concurrent database change preserves the public source", async () => {
  const state = dependencies({
    updateReference: async (mediaRow: typeof row, reference: string) => {
      state.events.push(`update:${mediaRow.id}:${reference}`);
      return false;
    },
  });
  const result = await migratePrivateMediaRows([row], state.deps, { publicBase });
  expect(result.failed).toBe(1);
  expect(state.events).toEqual([
    `copy:${key}`,
    `verify:${key}`,
    `update:${row.id}:r2-private://${key}`,
  ]);
});

test("already-private and unrelated rows are skipped with zero remainder", async () => {
  const { deps, events } = dependencies();
  const result = await migratePrivateMediaRows([
    { ...row, audioRef: `r2-private://${key}` },
    { ...row, id: "22222222-2222-4222-8222-222222222222", audioRef: "https://external.example/a.mp3" },
  ], deps, { publicBase });
  expect(result).toEqual({
    scanned: 2,
    migrated: 0,
    skipped: 2,
    failed: 0,
    remaining: 0,
  });
  expect(events).toEqual([]);
});
