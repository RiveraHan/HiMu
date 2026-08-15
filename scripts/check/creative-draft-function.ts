import assert from "node:assert/strict";

import {
  handleCreativeDraftRequest,
  type CreativeDraftDependencies,
} from "../../supabase/functions/creative-draft/handler.ts";

const identityOutput = JSON.stringify({
  candidates: [
    { name: "Static Bloom", identityConcept: "A patient selector tracing city lights through warm analog haze." },
    { name: "Velvet Index", identityConcept: "A curious archivist reshaping forgotten dance floors into intimate rituals." },
    { name: "Orbit Mercy", identityConcept: "A celestial night guide balancing kinetic rhythm with quiet gravity." },
  ],
});
const trackOutput = JSON.stringify({ title: "Glass Antennas" });

function dependencies(overrides: Partial<CreativeDraftDependencies> = {}) {
  const calls = {
    generated: [] as { endpoint: string; body: object }[],
    inserted: [] as { userId: string; kind: string }[],
    cleaned: [] as { userId: string; before: string }[],
  };
  const outputs = [identityOutput];
  const deps: CreativeDraftDependencies = {
    endpoint: "https://provider.invalid/llama",
    now: () => new Date("2026-08-14T12:00:00.000Z"),
    countRecentEvents: async () => 0,
    insertEvent: async (userId, kind) => void calls.inserted.push({ userId, kind }),
    deleteOldEvents: async (userId, before) => void calls.cleaned.push({ userId, before }),
    listExistingDjNames: async () => ["Quiet Metric"],
    loadDjContext: async () => ({
      ownerId: "user-1",
      djName: "Static Bloom",
      genres: ["House"],
      moods: ["Dreamy"],
      energy: 6,
      isInstrumental: false,
      vibe: "Rain-lit rooftop after midnight",
      identityConcept: "A patient selector tracing city lights through warm analog haze.",
    }),
    generateText: async (endpoint, body) => {
      calls.generated.push({ endpoint, body });
      return outputs.shift() ?? identityOutput;
    },
    ...overrides,
  };
  return { deps, calls, outputs };
}

const identityRequest = {
  version: 1,
  kind: "dj-identity",
  language: "en",
  traits: {
    genres: ["House"],
    moods: ["Dreamy"],
    energy: 6,
    isInstrumental: false,
    vibe: "Rain-lit rooftop after midnight",
  },
};

async function main() {
{
  const { deps, calls } = dependencies();
  const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
  assert.equal(result.status, 200);
  assert.equal(result.body.kind, "dj-identity");
  assert.equal((result.body.draft as { candidates: unknown[] }).candidates.length, 3);
  assert.deepEqual(calls.inserted, [{ userId: "user-1", kind: "dj-identity" }]);
  assert.equal(calls.generated.length, 1);
  assert.equal(calls.generated[0].endpoint, deps.endpoint);
  assert.doesNotMatch(JSON.stringify(calls.generated[0].body), /base_prompt|service_role/i);
}

{
  const { deps, outputs, calls } = dependencies();
  outputs.splice(0, outputs.length, trackOutput);
  const result = await handleCreativeDraftRequest(
    { version: 1, kind: "track-title", language: "en", djId: "dj-1", current: {} },
    "user-1",
    deps,
  );
  assert.deepEqual(result, {
    status: 200,
    body: { version: 1, kind: "track-title", draft: { title: "Glass Antennas" } },
  });
  assert.match(JSON.stringify(calls.generated[0].body), /House/);
  assert.match(JSON.stringify(calls.generated[0].body), /Static Bloom/);
}

{
  const { deps } = dependencies({
    loadDjContext: async () => ({
      ownerId: "another-user",
      djName: "Hidden DJ",
      genres: ["House"],
      moods: ["Dreamy"],
      energy: 6,
      isInstrumental: false,
      vibe: null,
      identityConcept: null,
    }),
  });
  const result = await handleCreativeDraftRequest(
    { version: 1, kind: "track-title", language: "en", djId: "dj-1", current: {} },
    "user-1",
    deps,
  );
  assert.deepEqual(result, { status: 403, body: { error: "not_owner", code: "not_owner" } });
}

{
  const { deps, calls } = dependencies({ countRecentEvents: async () => 30 });
  const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
  assert.deepEqual(result, {
    status: 429,
    body: { error: "draft_rate_limited", code: "draft_rate_limited" },
  });
  assert.equal(calls.generated.length, 0);
  assert.equal(calls.inserted.length, 0);
}

{
  const { deps, outputs, calls } = dependencies();
  outputs.splice(0, outputs.length, "not json", identityOutput);
  const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
  assert.equal(result.status, 200);
  assert.equal(calls.generated.length, 2);
  assert.match(JSON.stringify(calls.generated[1].body), /repair/i);
}

{
  const { deps, outputs } = dependencies();
  outputs.splice(0, outputs.length, "not json", "still not json");
  const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
  assert.deepEqual(result, {
    status: 502,
    body: { error: "malformed_draft", code: "malformed_draft" },
  });
}

{
  let attempt = 0;
  const { deps } = dependencies({
    generateText: async () => {
      attempt += 1;
      if (attempt === 1) return "not json";
      throw new Error("private upstream diagnostics");
    },
  });
  const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
  assert.deepEqual(result, {
    status: 503,
    body: { error: "provider_unavailable", code: "provider_unavailable" },
  });
}

{
  const { deps } = dependencies({
    generateText: async () => await new Promise<string>(() => undefined),
    timeoutMs: 5,
  });
  const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
  assert.deepEqual(result, {
    status: 504,
    body: { error: "draft_timeout", code: "draft_timeout" },
  });
}

{
  const { deps } = dependencies({
    generateText: async () => {
      throw new Error("token=super-secret provider body");
    },
  });
  const logged: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
  const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
  console.error = originalError;
  assert.deepEqual(result, {
    status: 503,
    body: { error: "provider_unavailable", code: "provider_unavailable" },
  });
  assert.doesNotMatch(JSON.stringify(result), /super-secret/);
  assert.doesNotMatch(JSON.stringify(logged), /super-secret/);
}

{
  const { deps, calls } = dependencies();
  const result = await handleCreativeDraftRequest({ ...identityRequest, traits: { ...identityRequest.traits, energy: 99 } }, "user-1", deps);
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: "invalid_input", code: "invalid_input" });
  assert.equal(calls.generated.length, 0);
}

console.log("creative draft function checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
