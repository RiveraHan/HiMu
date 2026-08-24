import { buildImageProviderBody } from "./creative-provider-adapters.ts";
import {
  assertWithinModelBudget,
  estimateModelCost,
  resolveCreativeModel,
  type CreativeModelRole,
  type ModelDefinition,
} from "./creative-models.ts";
import {
  logCreativeUsageEvent,
  runObservedCreativePrediction,
  type CreativeUsageEvent,
} from "./creative-telemetry.ts";
import { buildAvatarImageRequest } from "./dj-input.ts";
import {
  replicateMediaPrediction,
  type NormalizedPrediction,
} from "./replicate.ts";

export type AvatarContext = {
  genres: string[];
  moods: string[];
  identityConcept?: string | null;
  seed: string;
  language?: "en" | "es";
};

export type AvatarGenerationDependencies = {
  resolveModel: (role: CreativeModelRole) => ModelDefinition;
  predict: (
    endpoint: string,
    body: object,
  ) => Promise<NormalizedPrediction<string>>;
  fetchMedia: (url: string) => Promise<Response>;
  put: (
    key: string,
    bytes: Uint8Array,
    contentType: string,
    access: "public",
  ) => Promise<string>;
  recordUsage: (event: CreativeUsageEvent) => void;
  now: () => number;
};

export async function generateAvatarAsset(
  key: string,
  context: AvatarContext,
  deps: AvatarGenerationDependencies,
): Promise<string> {
  const model = deps.resolveModel("image_avatar");
  const image = buildAvatarImageRequest(
    context.genres,
    context.moods,
    context.identityConcept,
    context.seed,
  );
  assertWithinModelBudget(
    "image_avatar",
    estimateModelCost(model, { input: 0, output: 1 }),
  );
  const body = buildImageProviderBody(model, {
    prompt: image.prompt,
    aspectRatio: "1:1",
    outputFormat: "jpg",
    seed: image.seed,
  });
  const language = context.language ?? "en";
  const url = await runObservedCreativePrediction(
    {
      model,
      promptVersion: `avatar-v2.${language}`,
      briefVersion: 0,
      language,
      outcome: "generated",
      repaired: false,
      fallbackUnits: { output: 1 },
    },
    () => deps.predict(model.endpoint, body),
    deps.recordUsage,
    deps.now,
  );
  const response = await deps.fetchMedia(url);
  if (!response.ok) throw new Error(`avatar download failed (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("avatar download returned empty bytes");
  return await deps.put(key, bytes, "image/jpeg", "public");
}

export async function generateAvatarImage(
  key: string,
  context: AvatarContext,
): Promise<string> {
  const { r2Put } = await import("./r2.ts");
  return await generateAvatarAsset(key, context, {
    resolveModel: resolveCreativeModel,
    predict: (endpoint, body) =>
      replicateMediaPrediction(endpoint, body, {
        pollIntervalMs: 3_000,
        maxPolls: 80,
      }),
    fetchMedia: (url) => fetch(url),
    put: r2Put,
    recordUsage: logCreativeUsageEvent,
    now: Date.now,
  });
}
