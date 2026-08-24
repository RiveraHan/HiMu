import assert from "node:assert/strict";
import {
  createCreativeUsageEvent,
  estimatePredictionCost,
  logCreativeUsageEvent,
} from "../../supabase/functions/_shared/creative-telemetry.ts";
import { resolveCreativeModel } from "../../supabase/functions/_shared/creative-models.ts";
import type { NormalizedPrediction } from "../../supabase/functions/_shared/replicate.ts";

const eventInput = {
  role: "creative_longform",
  modelId: "anthropic/claude-sonnet-5",
  status: "succeeded",
  promptVersion: "creative-brief-v2.es",
  briefVersion: 2,
  language: "es",
  outcome: "valid_first_pass",
  repaired: false,
  latencyMs: 2_450,
  estimatedCostUsd: 0.0098,
  inputUnits: 850,
  outputUnits: 810,
} as const;

assert.deepEqual(createCreativeUsageEvent(eventInput), eventInput);

for (const forbidden of [
  { userId: "user-1" },
  { djId: "dj-1" },
  { jobId: "job-1" },
  { prompt: "private prompt" },
  { lyrics: "private lyrics" },
  { url: "https://private.example/media" },
  { data: { arbitrary: true } },
]) {
  assert.throws(
    () => createCreativeUsageEvent({ ...eventInput, ...forbidden }),
    /creative_usage_event/,
  );
}

for (const malformed of [
  { ...eventInput, role: "unknown" },
  { ...eventInput, modelId: "not a model" },
  { ...eventInput, status: "pending" },
  { ...eventInput, promptVersion: "contains spaces" },
  { ...eventInput, briefVersion: 3 },
  { ...eventInput, language: "fr" },
  { ...eventInput, outcome: "contains private free-form prose" },
  { ...eventInput, latencyMs: -1 },
  { ...eventInput, estimatedCostUsd: Number.NaN },
  { ...eventInput, inputUnits: 1.5 },
]) {
  assert.throws(() => createCreativeUsageEvent(malformed), /creative_usage_event/);
}

function prediction(metrics: NormalizedPrediction<string>["metrics"]): NormalizedPrediction<string> {
  return {
    output: "not inspected by telemetry",
    predictionId: "prediction-private",
    modelId: "model/private",
    startedAt: null,
    completedAt: null,
    metrics,
  };
}

const emptyMetrics = {
  inputTokens: null,
  outputTokens: null,
  inputCharacters: null,
  outputSeconds: null,
  predictSeconds: null,
};

assert.equal(
  estimatePredictionCost(
    resolveCreativeModel("creative_longform", {
      candidateId: "anthropic/claude-sonnet-5",
    }),
    prediction({ ...emptyMetrics, inputTokens: 900, outputTokens: 1_200 }),
  ),
  0.0138,
);
assert.equal(
  estimatePredictionCost(
    resolveCreativeModel("voice_caption"),
    prediction({ ...emptyMetrics, inputCharacters: 160 }),
  ),
  0.004,
);
assert.equal(
  estimatePredictionCost(
    resolveCreativeModel("music_full"),
    prediction(emptyMetrics),
  ),
  0.08,
);
assert.equal(
  estimatePredictionCost(
    resolveCreativeModel("image_cover", {
      candidateId: "black-forest-labs/flux-2-klein-9b",
    }),
    prediction(emptyMetrics),
    { output: 1 },
  ),
  0.015,
);

const logs: string[] = [];
logCreativeUsageEvent(eventInput, (line) => logs.push(line));
assert.equal(logs.length, 1);
assert.match(logs[0], /^\[creative_usage\] \{/);
assert.doesNotMatch(logs[0], /user-1|dj-1|job-1|private prompt|private lyrics|https?:\/\//);
assert.deepEqual(
  JSON.parse(logs[0].replace(/^\[creative_usage\] /, "")),
  eventInput,
);

console.log("creative telemetry checks passed");
