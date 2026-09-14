import assert from "node:assert/strict";
import {
  createCreativeUsageEvent,
  estimatePredictionCost,
  logCreativeUsageEvent,
  type CreativeUsageEvent,
} from "../../supabase/functions/_shared/creative-telemetry.ts";
import { resolveCreativeModel } from "../../supabase/functions/_shared/creative-models.ts";
import type { NormalizedPrediction } from "../../supabase/functions/_shared/replicate.ts";
import * as telemetryModule from "../../supabase/functions/_shared/creative-telemetry.ts";

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

async function checkObservedPrediction() {
  const events: CreativeUsageEvent[] = [];
  const timestamps = [10_000, 10_750];
  const runObserved = (telemetryModule as unknown as {
    runObservedCreativePrediction?: <T>(
      context: Record<string, unknown>,
      run: () => Promise<NormalizedPrediction<T>>,
      recordUsage: (event: CreativeUsageEvent) => void,
      now: () => number,
    ) => Promise<T>;
  }).runObservedCreativePrediction;
  const result = runObserved
    ? await runObserved(
      {
        model: resolveCreativeModel("music_full"),
        promptVersion: "music-production-v2.es",
        briefVersion: 2,
        language: "es",
        outcome: "generated",
        repaired: false,
        fallbackUnits: { input: 2_400, output: 1 },
      },
      async () => prediction({
        ...emptyMetrics,
        outputSeconds: 150.25,
        predictSeconds: 42.8,
      }),
      (event) => events.push(event),
      () => timestamps.shift() ?? 10_750,
    )
    : null;

  assert.equal(result, "not inspected by telemetry");
  assert.deepEqual(events, [{
    role: "music_full",
    modelId: "google/lyria-3-pro",
    status: "succeeded",
    promptVersion: "music-production-v2.es",
    briefVersion: 2,
    language: "es",
    outcome: "generated",
    repaired: false,
    latencyMs: 750,
    estimatedCostUsd: 0.08,
    inputUnits: null,
    outputUnits: 1,
  }]);
  assert.doesNotMatch(JSON.stringify(events), /not inspected by telemetry/);

  const failedEvents: CreativeUsageEvent[] = [];
  const failedTimestamps = [20_000, 20_250];
  let failure: unknown;
  try {
    if (!runObserved) throw new Error("observer unavailable");
    await runObserved(
      {
        model: resolveCreativeModel("music_full"),
        promptVersion: "music-production-v2.en",
        briefVersion: 0,
        language: "en",
        outcome: "generated",
        repaired: false,
        fallbackUnits: { output: 1 },
      },
      async () => {
        throw new Error("private provider failure");
      },
      (event) => failedEvents.push(event),
      () => failedTimestamps.shift() ?? 20_250,
    );
  } catch (error) {
    failure = error;
  }
  assert.match(String(failure), /private provider failure/);
  assert.deepEqual(failedEvents, [{
    role: "music_full",
    modelId: "google/lyria-3-pro",
    status: "failed",
    promptVersion: "music-production-v2.en",
    briefVersion: 0,
    language: "en",
    outcome: "provider_error",
    repaired: false,
    latencyMs: 250,
    estimatedCostUsd: 0.08,
    inputUnits: null,
    outputUnits: null,
  }]);
  assert.doesNotMatch(JSON.stringify(failedEvents), /private provider failure/);
}

checkObservedPrediction()
  .then(() => console.log("creative telemetry checks passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
