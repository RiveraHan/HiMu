import assert from "node:assert/strict";
import { runAvatarGeneration } from "../../supabase/functions/update-dj/avatar-reservation";

async function main() {
const input = {
  userId: "user-1",
  operation: "avatar_regen" as const,
  requestId: "request-1",
};

{
  let generated = 0;
  const result = await runAvatarGeneration(input, {
    reserve: async () => ({
      outcome: "quota",
      eventId: null,
      limit: 3,
      resourceId: null,
    }),
    generate: async () => {
      generated += 1;
      return "must-not-run";
    },
  });
  assert.deepEqual(result, { outcome: "quota", limit: 3 });
  assert.equal(generated, 0);
}

for (const outcome of ["created", "existing"] as const) {
  let generated = 0;
  const result = await runAvatarGeneration(input, {
    reserve: async () => ({
      outcome,
      eventId: "event-1",
      limit: 3,
      resourceId: "request-1",
    }),
    generate: async () => {
      generated += 1;
      return "avatar-url";
    },
  });
  assert.deepEqual(result, { outcome: "generated", value: "avatar-url" });
  assert.equal(generated, 1);
}

await assert.rejects(
  runAvatarGeneration(input, {
    reserve: async () => ({
      outcome: "created",
      eventId: "event-1",
      limit: 3,
      resourceId: "request-1",
    }),
    generate: async () => {
      throw new Error("provider failed");
    },
  }),
  /provider failed/,
);

console.log("avatar reservation checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
