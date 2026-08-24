import assert from "node:assert/strict";

import * as coverModule from "../../supabase/functions/_shared/cover.ts";
import type { CreativeUsageEvent } from "../../supabase/functions/_shared/creative-telemetry.ts";
import type { ModelDefinition } from "../../supabase/functions/_shared/creative-models.ts";
import type { NormalizedPrediction } from "../../supabase/functions/_shared/replicate.ts";

const emptyMetrics: NormalizedPrediction<string>["metrics"] = {
  inputTokens: null,
  outputTokens: null,
  inputCharacters: null,
  outputSeconds: null,
  predictSeconds: null,
};

async function main() {
  const events: CreativeUsageEvent[] = [];
  const timestamps = [1_000, 1_480];
  const generatedBodies: object[] = [];
  const generateCoverAsset = (coverModule as unknown as {
    generateCoverAsset?: (
      key: string,
      context: Record<string, unknown>,
      dependencies: Record<string, unknown>,
    ) => Promise<string>;
  }).generateCoverAsset;

  const result = generateCoverAsset
    ? await generateCoverAsset(
      "covers/generated/job-1.jpg",
      {
        genre: "House",
        moods: ["Dreamy"],
        instrumental: false,
        seed: "cover-seed",
        visualPlan: null,
        language: "es",
        briefVersion: 2,
      },
      {
        resolveModel: (role: string) => {
          assert.equal(role, "image_cover");
          return {
            id: "openai/gpt-image-2",
            role: "image_cover",
            endpoint: "https://provider.invalid/image",
            adapter: "gpt_image",
            lifecycle: "promoted",
            price: { unit: "output", outputUsd: 0.012, per: 1 },
            limits: { input: 4_000, output: 1, timeoutMs: 120_000, maxCostUsd: 0.012 },
            verifiedAt: "2026-08-24",
          } satisfies ModelDefinition;
        },
        predict: async (_endpoint: string, body: object) => {
          generatedBodies.push(body);
          return {
            output: "https://provider.invalid/generated.jpg",
            predictionId: "image-prediction-1",
            modelId: "openai/gpt-image-2",
            startedAt: null,
            completedAt: null,
            metrics: emptyMetrics,
          } satisfies NormalizedPrediction<string>;
        },
        fetchMedia: async (url: string) => {
          assert.equal(url, "https://provider.invalid/generated.jpg");
          return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
        },
        put: async (key: string, bytes: Uint8Array) => {
          assert.equal(key, "covers/generated/job-1.jpg");
          assert.deepEqual([...bytes], [1, 2, 3]);
          return "https://cdn.invalid/cover.jpg";
        },
        recordUsage: (event: CreativeUsageEvent) => events.push(event),
        now: () => timestamps.shift() ?? 1_480,
      },
    )
    : null;

  assert.equal(result, "https://cdn.invalid/cover.jpg");
  assert.equal(generatedBodies.length, 1);
  assert.deepEqual(events, [{
    role: "image_cover",
    modelId: "openai/gpt-image-2",
    status: "succeeded",
    promptVersion: "cover-v2.es",
    briefVersion: 2,
    language: "es",
    outcome: "generated",
    repaired: false,
    latencyMs: 480,
    estimatedCostUsd: 0.012,
    inputUnits: null,
    outputUnits: 1,
  }]);
  assert.doesNotMatch(JSON.stringify(events), /cover-seed|House|Dreamy|provider\.invalid|cdn\.invalid/);

  const avatarModule = await import(
    "../../supabase/functions/_shared/avatar.ts"
  ).catch(() => null);
  const avatarEvents: CreativeUsageEvent[] = [];
  const avatarTimestamps = [2_000, 2_390];
  const generateAvatarAsset = avatarModule?.generateAvatarAsset;
  const avatarResult = generateAvatarAsset
    ? await generateAvatarAsset(
      "avatars/generated/dj-1.jpg",
      {
        genres: ["Afro House"],
        moods: ["Hypnotic"],
        identityConcept: "A fictional dusk cartographer turning percussion into constellations.",
        seed: "avatar-seed",
        language: "en",
      },
      {
        resolveModel: () => ({
          id: "openai/gpt-image-2",
          role: "image_avatar",
          endpoint: "https://provider.invalid/avatar",
          adapter: "gpt_image",
          lifecycle: "promoted",
          price: { unit: "output", outputUsd: 0.012, per: 1 },
          limits: { input: 4_000, output: 1, timeoutMs: 120_000, maxCostUsd: 0.012 },
          verifiedAt: "2026-08-24",
        } satisfies ModelDefinition),
        predict: async () => ({
          output: "https://provider.invalid/avatar.jpg",
          predictionId: "avatar-prediction-1",
          modelId: "openai/gpt-image-2",
          startedAt: null,
          completedAt: null,
          metrics: emptyMetrics,
        } satisfies NormalizedPrediction<string>),
        fetchMedia: async () =>
          new Response(new Uint8Array([4, 5, 6]), { status: 200 }),
        put: async (key: string, bytes: Uint8Array) => {
          assert.equal(key, "avatars/generated/dj-1.jpg");
          assert.deepEqual([...bytes], [4, 5, 6]);
          return "https://cdn.invalid/avatar.jpg";
        },
        recordUsage: (event: CreativeUsageEvent) => avatarEvents.push(event),
        now: () => avatarTimestamps.shift() ?? 2_390,
      },
    )
    : null;

  assert.equal(avatarResult, "https://cdn.invalid/avatar.jpg");
  assert.deepEqual(avatarEvents, [{
    role: "image_avatar",
    modelId: "openai/gpt-image-2",
    status: "succeeded",
    promptVersion: "avatar-v2.en",
    briefVersion: 0,
    language: "en",
    outcome: "generated",
    repaired: false,
    latencyMs: 390,
    estimatedCostUsd: 0.012,
    inputUnits: null,
    outputUnits: 1,
  }]);
  assert.doesNotMatch(
    JSON.stringify(avatarEvents),
    /avatar-seed|Afro House|Hypnotic|cartographer|provider\.invalid|cdn\.invalid/,
  );
}

main()
  .then(() => console.log("creative media telemetry checks passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
