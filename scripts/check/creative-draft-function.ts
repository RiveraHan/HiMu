import assert from "node:assert/strict";

import {
  handleCreativeDraftRequest,
  type CreativeDraftDependencies,
} from "../../supabase/functions/creative-draft/handler.ts";
import {
  resolveCreativeModel,
  type ModelDefinition,
} from "../../supabase/functions/_shared/creative-models.ts";
import type { CreativeUsageEvent } from "../../supabase/functions/_shared/creative-telemetry.ts";
import type { NormalizedPrediction } from "../../supabase/functions/_shared/replicate.ts";

const identityOutput = JSON.stringify({
  candidates: [
    { name: "Static Bloom", identityConcept: "A patient selector tracing city lights through warm analog haze." },
    { name: "Velvet Index", identityConcept: "A curious archivist reshaping forgotten dance floors into intimate rituals." },
    { name: "Orbit Mercy", identityConcept: "A celestial night guide balancing kinetic rhythm with quiet gravity." },
  ],
});
const trackOutput = JSON.stringify({ title: "Glass Antennas" });
const trackBriefOutput = JSON.stringify({
  title: "Glass Antennas",
  creativeDirection:
    "A restrained nocturnal verse opens into a wide chorus led by glass mallets.",
  lyricTheme: "Choosing wonder over certainty",
  lyrics:
    "[Verse 1]\nStreetlights draw a map across the rain\n[Chorus]\nWe choose the glow and start again",
  productionPlan: {
    bpm: 118,
    key: "F# minor",
    meter: "4/4",
    sections: [
      { name: "intro", startSeconds: 0, endSeconds: 16, direction: "Reveal one glass motif over filtered percussion." },
      { name: "verse", startSeconds: 16, endSeconds: 54, direction: "Keep the vocal close over restrained bass and dry rim clicks." },
      { name: "chorus", startSeconds: 54, endSeconds: 94, direction: "Widen harmony and answer the hook with bright mallets." },
      { name: "outro", startSeconds: 94, endSeconds: 120, direction: "Dissolve the motif into rain-like delay without a hard stop." },
    ],
    leadInstruments: ["glass mallets", "breathy alto voice"],
    rhythmInstruments: ["round sub bass", "dry rim clicks"],
    textureInstruments: ["tape hiss", "rain-like delay"],
    energyArc: "Rise from close-mic restraint to a luminous final chorus.",
    productionCharacter: ["warm analog saturation", "precise transient detail"],
    vocalDirection: "Natural contemporary English with intimate verses and a sustained chorus hook.",
    visual: {
      concept: "A fragile signal becomes a shared constellation in rain.",
      subject: "Translucent antenna forms above a wet rooftop",
      medium: "Layered paper sculpture photographed on film",
      composition: "Asymmetric square frame rising from the lower third",
      palette: ["smoked indigo", "warm amber", "frosted cyan"],
      lighting: "Low amber side light with cyan reflections",
      texture: "Visible paper fibers, fine rain grain, restrained halation",
    },
    novelty: {
      coreMotifs: ["glass antenna response", "ascending three-note signal"],
      avoidRecentMotifs: ["neon tunnel", "piano house hook"],
    },
  },
});

function dependencies(overrides: Partial<CreativeDraftDependencies> = {}) {
  const calls = {
    generated: [] as { model: ModelDefinition; body: object }[],
    reserved: [] as { userId: string; kind: string; requestId: string }[],
    memoryLoaded: [] as string[],
  };
  const outputs = [identityOutput];
  const deps: CreativeDraftDependencies = {
    resolveModel: (role) => resolveCreativeModel(role),
    randomId: () => "11111111-1111-4111-8111-111111111111",
    reserveDraft: async (userId: string, kind: string, requestId: string) => {
      calls.reserved.push({ userId, kind, requestId });
      return { outcome: "created" as const, limit: 30 };
    },
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
      durationSeconds: 120,
    }),
    loadRecentMemory: async (djId: string) => {
      calls.memoryLoaded.push(djId);
      return {
        titles: ["Cables Beneath Rain"],
        identityNames: [],
        visualMotifs: ["generic neon tunnel"],
        hooks: ["descending glass signal"],
        productionFingerprints: ["118 BPM | F# minor | piano house"],
      };
    },
    generateText: async (model, body) => {
      calls.generated.push({ model, body });
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
  assert.deepEqual(calls.reserved, [{
    userId: "user-1",
    kind: "dj-identity",
    requestId: "11111111-1111-4111-8111-111111111111",
  }]);
  assert.equal(calls.generated.length, 1);
  assert.equal(calls.generated[0].model.role, "creative_shortform");
  assert.equal(calls.generated[0].model.id, "meta/llama-4-scout-instruct");
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
  const { deps, outputs, calls } = dependencies();
  outputs.splice(0, outputs.length, trackBriefOutput);
  const result = await handleCreativeDraftRequest(
    {
      version: 1,
      kind: "track-brief",
      language: "en",
      djId: "dj-1",
      current: {},
      exclude: [],
    },
    "user-1",
    deps,
  );
  assert.equal(result.status, 200);
  assert.equal(
    ((result.body.draft as Record<string, unknown>).productionPlan as {
      bpm: number;
    }).bpm,
    118,
  );
  assert.equal(
    ((calls.generated[0].body as { input: { max_tokens: number } }).input)
      .max_tokens,
    1_200,
  );
  assert.match(JSON.stringify(calls.generated[0].body), /creative-brief-v2/);
  assert.match(JSON.stringify(calls.generated[0].body), /Cables Beneath Rain/);
  assert.match(JSON.stringify(calls.generated[0].body), /generic neon tunnel/);
  assert.deepEqual(calls.memoryLoaded, ["dj-1"]);
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
  const { deps, calls } = dependencies({
    reserveDraft: async () => ({ outcome: "quota" as const, limit: 30 }),
  });
  const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
  assert.deepEqual(result, {
    status: 429,
    body: { error: "draft_rate_limited", code: "draft_rate_limited" },
  });
  assert.equal(calls.generated.length, 0);
  assert.equal(calls.reserved.length, 0);
}

{
  const repeatsVisibleName = JSON.stringify({
    candidates: [
      { name: "Quiet Metric", identityConcept: "A patient selector tracing city lights through warm analog haze." },
      { name: "Velvet Index", identityConcept: "A curious archivist reshaping forgotten dance floors into intimate rituals." },
      { name: "Orbit Mercy", identityConcept: "A celestial night guide balancing kinetic rhythm with quiet gravity." },
    ],
  });
  const { deps, outputs, calls } = dependencies();
  outputs.splice(0, outputs.length, repeatsVisibleName, repeatsVisibleName);
  const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
  assert.deepEqual(result, {
    status: 502,
    body: { error: "malformed_draft", code: "malformed_draft" },
  });
  assert.match(JSON.stringify(calls.generated[0].body), /Quiet Metric/);
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

{
  const { deps, outputs } = dependencies();
  outputs.splice(0, outputs.length, trackBriefOutput);
  const usage: CreativeUsageEvent[] = [];
  const timestamps = [1_000, 1_250];
  const observedDeps = {
    ...deps,
    now: () => timestamps.shift() ?? 1_250,
    recordUsage: (event: CreativeUsageEvent) => usage.push(event),
  } as CreativeDraftDependencies & {
    now: () => number;
    recordUsage: (event: CreativeUsageEvent) => void;
  };
  const result = await handleCreativeDraftRequest(
    {
      version: 1,
      kind: "track-brief",
      language: "en",
      djId: "dj-1",
      current: {},
      exclude: [],
    },
    "user-1",
    observedDeps,
  );
  assert.equal(result.status, 200);
  assert.deepEqual(usage, [{
    role: "creative_longform",
    modelId: "meta/llama-4-scout-instruct",
    status: "succeeded",
    promptVersion: "creative-brief-v2.en",
    briefVersion: 2,
    language: "en",
    outcome: "accepted",
    repaired: false,
    latencyMs: 250,
    estimatedCostUsd: 0.000967,
    inputUnits: null,
    outputUnits: null,
  }]);
}

{
  const prediction: NormalizedPrediction<string> = {
    output: trackBriefOutput,
    predictionId: "prediction-1",
    modelId: "meta/llama-4-scout-instruct",
    startedAt: "2026-08-24T08:00:00.000Z",
    completedAt: "2026-08-24T08:00:00.420Z",
    metrics: {
      inputTokens: 400,
      outputTokens: 500,
      inputCharacters: null,
      outputSeconds: null,
      predictSeconds: 0.42,
    },
  };
  const usage: CreativeUsageEvent[] = [];
  const timestamps = [2_000, 2_600];
  const { deps } = dependencies({
    generateText: async () => prediction as never,
    now: () => timestamps.shift() ?? 2_600,
    recordUsage: (event) => usage.push(event),
  });
  const result = await handleCreativeDraftRequest(
    {
      version: 1,
      kind: "track-brief",
      language: "en",
      djId: "dj-1",
      current: {},
      exclude: [],
    },
    "user-1",
    deps,
  );
  assert.equal(result.status, 200);
  assert.deepEqual(usage, [{
    role: "creative_longform",
    modelId: "meta/llama-4-scout-instruct",
    status: "succeeded",
    promptVersion: "creative-brief-v2.en",
    briefVersion: 2,
    language: "en",
    outcome: "accepted",
    repaired: false,
    latencyMs: 600,
    estimatedCostUsd: 0.000393,
    inputUnits: 400,
    outputUnits: 500,
  }]);
}

{
  const usage: CreativeUsageEvent[] = [];
  const timestamps = [3_000, 3_200, 3_200, 3_550];
  const { deps, outputs } = dependencies({
    now: () => timestamps.shift() ?? 3_550,
    recordUsage: (event) => usage.push(event),
  });
  outputs.splice(0, outputs.length, "not json", identityOutput);
  const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
  assert.equal(result.status, 200);
  assert.deepEqual(usage, [
    {
      role: "creative_shortform",
      modelId: "meta/llama-4-scout-instruct",
      status: "rejected",
      promptVersion: "creative-dj-identity-v2.en",
      briefVersion: 0,
      language: "en",
      outcome: "invalid_output",
      repaired: false,
      latencyMs: 200,
      estimatedCostUsd: 0.000413,
      inputUnits: null,
      outputUnits: null,
    },
    {
      role: "format_repair",
      modelId: "meta/llama-4-scout-instruct",
      status: "succeeded",
      promptVersion: "creative-dj-identity-v2.en",
      briefVersion: 0,
      language: "en",
      outcome: "accepted",
      repaired: true,
      latencyMs: 350,
      estimatedCostUsd: 0.000413,
      inputUnits: null,
      outputUnits: null,
    },
  ]);
}

{
  const usage: CreativeUsageEvent[] = [];
  const timestamps = [4_000, 4_100];
  const { deps } = dependencies({
    generateText: async () => {
      throw new Error("private upstream diagnostics");
    },
    now: () => timestamps.shift() ?? 4_100,
    recordUsage: (event) => usage.push(event),
  });
  const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
  assert.equal(result.status, 503);
  assert.deepEqual(usage, [{
    role: "creative_shortform",
    modelId: "meta/llama-4-scout-instruct",
    status: "failed",
    promptVersion: "creative-dj-identity-v2.en",
    briefVersion: 0,
    language: "en",
    outcome: "provider_error",
    repaired: false,
    latencyMs: 100,
    estimatedCostUsd: 0.000413,
    inputUnits: null,
    outputUnits: null,
  }]);
}

{
  const usage: CreativeUsageEvent[] = [];
  const timestamps = [5_000, 5_007];
  const { deps } = dependencies({
    generateText: async () => await new Promise<string>(() => undefined),
    timeoutMs: 5,
    now: () => timestamps.shift() ?? 5_007,
    recordUsage: (event) => usage.push(event),
  });
  const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
  assert.equal(result.status, 504);
  assert.deepEqual(usage, [{
    role: "creative_shortform",
    modelId: "meta/llama-4-scout-instruct",
    status: "failed",
    promptVersion: "creative-dj-identity-v2.en",
    briefVersion: 0,
    language: "en",
    outcome: "timeout",
    repaired: false,
    latencyMs: 7,
    estimatedCostUsd: 0.000413,
    inputUnits: null,
    outputUnits: null,
  }]);
}

{
  const usage: CreativeUsageEvent[] = [];
  const timestamps = [6_000, 6_100, 6_100, 6_300];
  const { deps, outputs } = dependencies({
    now: () => timestamps.shift() ?? 6_300,
    recordUsage: (event) => usage.push(event),
  });
  outputs.splice(0, outputs.length, "not json", "still not json");
  const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
  assert.equal(result.status, 502);
  assert.deepEqual(usage, [
    {
      role: "creative_shortform",
      modelId: "meta/llama-4-scout-instruct",
      status: "rejected",
      promptVersion: "creative-dj-identity-v2.en",
      briefVersion: 0,
      language: "en",
      outcome: "invalid_output",
      repaired: false,
      latencyMs: 100,
      estimatedCostUsd: 0.000413,
      inputUnits: null,
      outputUnits: null,
    },
    {
      role: "format_repair",
      modelId: "meta/llama-4-scout-instruct",
      status: "rejected",
      promptVersion: "creative-dj-identity-v2.en",
      briefVersion: 0,
      language: "en",
      outcome: "invalid_output",
      repaired: true,
      latencyMs: 200,
      estimatedCostUsd: 0.000413,
      inputUnits: null,
      outputUnits: null,
    },
  ]);
}

{
  let attempt = 0;
  const usage: CreativeUsageEvent[] = [];
  const timestamps = [7_000, 7_100, 7_100, 7_250];
  const { deps } = dependencies({
    generateText: async () => {
      attempt += 1;
      if (attempt === 1) return "not json";
      throw new Error("private repair diagnostics");
    },
    now: () => timestamps.shift() ?? 7_250,
    recordUsage: (event) => usage.push(event),
  });
  const result = await handleCreativeDraftRequest(identityRequest, "user-1", deps);
  assert.equal(result.status, 503);
  assert.deepEqual(usage, [
    {
      role: "creative_shortform",
      modelId: "meta/llama-4-scout-instruct",
      status: "rejected",
      promptVersion: "creative-dj-identity-v2.en",
      briefVersion: 0,
      language: "en",
      outcome: "invalid_output",
      repaired: false,
      latencyMs: 100,
      estimatedCostUsd: 0.000413,
      inputUnits: null,
      outputUnits: null,
    },
    {
      role: "format_repair",
      modelId: "meta/llama-4-scout-instruct",
      status: "failed",
      promptVersion: "creative-dj-identity-v2.en",
      briefVersion: 0,
      language: "en",
      outcome: "provider_error",
      repaired: true,
      latencyMs: 150,
      estimatedCostUsd: 0.000413,
      inputUnits: null,
      outputUnits: null,
    },
  ]);
}

console.log("creative draft function checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
