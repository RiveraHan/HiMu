import assert from "node:assert/strict";
import {
  buildImageProviderBody,
  buildTextProviderBody,
} from "../../supabase/functions/_shared/creative-provider-adapters.ts";
import { resolveCreativeModel } from "../../supabase/functions/_shared/creative-models.ts";
import {
  parseReplicateMediaOutput,
  parseReplicateTextOutput,
  replicatePrediction,
} from "../../supabase/functions/_shared/replicate.ts";

async function main(): Promise<void> {
const textRequest = {
  system: "Return valid JSON only.",
  prompt: "Create an original bilingual brief.",
  maxOutputTokens: 400,
  temperature: 0.7,
};

assert.deepEqual(
  buildTextProviderBody(resolveCreativeModel("creative_shortform"), textRequest),
  {
    input: {
      system_prompt: textRequest.system,
      prompt: textRequest.prompt,
      max_tokens: 400,
      temperature: 0.7,
    },
  },
);
assert.deepEqual(
  buildTextProviderBody(
    resolveCreativeModel("creative_longform", {
      candidateId: "anthropic/claude-sonnet-5",
    }),
    textRequest,
  ),
  {
    input: {
      system_prompt: textRequest.system,
      prompt: textRequest.prompt,
      max_tokens: 400,
      temperature: 0.7,
      effort: "low",
    },
  },
);
assert.deepEqual(
  buildTextProviderBody(
    resolveCreativeModel("creative_shortform", {
      candidateId: "openai/gpt-5.6-luna",
    }),
    textRequest,
  ),
  {
    input: {
      system_prompt: textRequest.system,
      prompt: textRequest.prompt,
      max_completion_tokens: 400,
      reasoning_effort: "none",
      verbosity: "low",
    },
  },
);
assert.deepEqual(
  buildTextProviderBody(
    resolveCreativeModel("creative_shortform", {
      candidateId: "google/gemini-3-flash",
    }),
    textRequest,
  ),
  {
    input: {
      system_instruction: textRequest.system,
      prompt: textRequest.prompt,
      max_output_tokens: 400,
      temperature: 0.7,
      thinking_level: "none",
    },
  },
);

const imageRequest = {
  prompt: "Square album artwork, abstract paper sculpture, no text.",
  aspectRatio: "1:1" as const,
  outputFormat: "jpg" as const,
  seed: 42,
};
assert.deepEqual(
  buildImageProviderBody(
    resolveCreativeModel("image_cover", { candidateId: "openai/gpt-image-2" }),
    imageRequest,
  ),
  {
    input: {
      prompt: imageRequest.prompt,
      aspect_ratio: "1:1",
      output_format: "jpeg",
      quality: "low",
      background: "opaque",
      moderation: "auto",
      number_of_images: 1,
      output_compression: 92,
    },
  },
);
assert.deepEqual(
  buildImageProviderBody(
    resolveCreativeModel("image_cover", {
      candidateId: "black-forest-labs/flux-2-klein-9b",
    }),
    imageRequest,
  ),
  {
    input: {
      prompt: imageRequest.prompt,
      aspect_ratio: "1:1",
      output_format: "jpg",
      output_quality: 92,
      megapixels: "1",
      disable_safety_checker: false,
      seed: 42,
    },
  },
);
assert.deepEqual(
  buildImageProviderBody(
    resolveCreativeModel("image_cover", { candidateId: "reve/create" }),
    imageRequest,
  ),
  {
    input: {
      prompt: imageRequest.prompt,
      aspect_ratio: "1:1",
      version: "latest",
      seed: 42,
    },
  },
);

assert.equal(parseReplicateTextOutput(["one", " ", "line"]), "one line");
assert.equal(parseReplicateTextOutput("one line"), "one line");
assert.throws(() => parseReplicateTextOutput(null), /replicate_text_output/);
assert.equal(parseReplicateMediaOutput(["https://media.example/cover.jpg"]), "https://media.example/cover.jpg");
assert.equal(parseReplicateMediaOutput("https://media.example/voice.mp3"), "https://media.example/voice.mp3");
assert.throws(() => parseReplicateMediaOutput([]), /replicate_media_output/);

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const calls: Array<{ url: string; init?: RequestInit }> = [];
const replies = [
  response({
    id: "prediction-1",
    status: "processing",
    urls: { get: "https://api.replicate.com/v1/predictions/prediction-1" },
    output: null,
    error: null,
    created_at: "2026-08-24T10:00:00Z",
    started_at: "2026-08-24T10:00:01Z",
    completed_at: null,
    metrics: {},
  }),
  response({
    id: "prediction-1",
    status: "succeeded",
    urls: { get: "https://api.replicate.com/v1/predictions/prediction-1" },
    output: ["{\"title\":", "\"Mar Abierto\"}"],
    error: null,
    created_at: "2026-08-24T10:00:00Z",
    started_at: "2026-08-24T10:00:01Z",
    completed_at: "2026-08-24T10:00:03Z",
    metrics: {
      input_token_count: 120,
      output_token_count: 35,
      predict_time: 2.1,
    },
  }),
];
const normalized = await replicatePrediction(
  "https://api.replicate.com/v1/models/google/gemini-3-flash/predictions",
  { input: { prompt: "safe fixture" } },
  parseReplicateTextOutput,
  {
    token: "test-token",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      const next = replies.shift();
      if (!next) throw new Error("unexpected fetch");
      return next;
    },
    sleep: async () => {},
    pollIntervalMs: 0,
    maxPolls: 2,
  },
);
assert.deepEqual(normalized, {
  output: '{"title":"Mar Abierto"}',
  predictionId: "prediction-1",
  modelId: "google/gemini-3-flash",
  startedAt: "2026-08-24T10:00:01Z",
  completedAt: "2026-08-24T10:00:03Z",
  metrics: {
    inputTokens: 120,
    outputTokens: 35,
    inputCharacters: null,
    outputSeconds: null,
    predictSeconds: 2.1,
  },
});
assert.equal(calls.length, 2);
assert.equal(calls[0].init?.method, "POST");
assert.equal(calls[1].url, "https://api.replicate.com/v1/predictions/prediction-1");

const rateLimitSleeps: number[] = [];
const rateLimitReplies = [
  response({ status: "starting", retry_after: 2, error: null }, 429),
  response({
    id: "prediction-2",
    status: "succeeded",
    urls: { get: "https://api.replicate.com/v1/predictions/prediction-2" },
    output: "https://media.example/output.jpg",
    error: null,
    created_at: null,
    started_at: null,
    completed_at: null,
    metrics: { character_input_count: 160, output_duration: 4.2 },
  }),
];
const media = await replicatePrediction(
  "https://api.replicate.com/v1/models/reve/create/predictions",
  { input: { prompt: "safe fixture" } },
  parseReplicateMediaOutput,
  {
    token: "test-token",
    fetchImpl: async () => rateLimitReplies.shift()!,
    sleep: async (ms) => rateLimitSleeps.push(ms),
  },
);
assert.equal(media.output, "https://media.example/output.jpg");
assert.equal(media.metrics.inputCharacters, 160);
assert.equal(media.metrics.outputSeconds, 4.2);
assert.deepEqual(rateLimitSleeps, [3_000]);

await assert.rejects(
  () => replicatePrediction(
    "https://api.replicate.com/v1/models/google/gemini-3-flash/predictions",
    { input: { prompt: "sensitive prompt" } },
    parseReplicateTextOutput,
    {
      token: "test-token",
      fetchImpl: async () => response({ error: "sensitive prompt leaked" }, 400),
      sleep: async () => {},
    },
  ),
  (error: unknown) =>
    error instanceof Error && /Replicate \(400\): request failed/.test(error.message) &&
    !/sensitive prompt/.test(error.message),
);

await assert.rejects(
  () => replicatePrediction(
    "https://api.replicate.com/v1/models/google/gemini-3-flash/predictions",
    { input: { prompt: "safe fixture" } },
    parseReplicateTextOutput,
    {
      token: "test-token",
      fetchImpl: async () => response({
        id: "prediction-3",
        status: "processing",
        urls: { get: "https://api.replicate.com/v1/predictions/prediction-3" },
        output: null,
        error: null,
      }),
      sleep: async () => {},
      pollIntervalMs: 0,
      maxPolls: 1,
    },
  ),
  /Replicate timeout/,
);

  console.log("creative provider adapter checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
