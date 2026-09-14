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
import {
  compileVisualDirection,
  renderVisualPrompt,
  type VisualPlan,
} from "./visual-direction.ts";
import {
  replicateMediaPrediction,
  type NormalizedPrediction,
} from "./replicate.ts";

export type CoverContext = {
  genre: string;
  moods: string[];
  instrumental: boolean;
  seed?: string;
  visualPlan?: VisualPlan | null;
  language?: "en" | "es";
  briefVersion?: 0 | 1 | 2;
};

export type CoverGenerationDependencies = {
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

export function coverPrompt(ctx: CoverContext): string {
  return renderVisualPrompt(compileVisualDirection({
    purpose: "cover",
    seed: ctx.seed ?? JSON.stringify([
      ctx.genre,
      ctx.moods,
      ctx.instrumental,
      ctx.visualPlan,
    ]),
    genres: ctx.genre.trim() ? [ctx.genre] : [],
    moods: ctx.moods,
    instrumental: ctx.instrumental,
    identityConcept: null,
    visualPlan: ctx.visualPlan ?? null,
  }));
}

export async function generateCoverAsset(
  key: string,
  ctx: CoverContext,
  deps: CoverGenerationDependencies,
): Promise<string> {
  const model = deps.resolveModel("image_cover");
  const direction = compileVisualDirection({
    purpose: "cover",
    seed: ctx.seed ?? key,
    genres: ctx.genre.trim() ? [ctx.genre] : [],
    moods: ctx.moods,
    instrumental: ctx.instrumental,
    identityConcept: null,
    visualPlan: ctx.visualPlan ?? null,
  });
  assertWithinModelBudget(
    "image_cover",
    estimateModelCost(model, { input: 0, output: 1 }),
  );
  const body = buildImageProviderBody(model, {
      prompt: renderVisualPrompt(direction),
      aspectRatio: "1:1",
      outputFormat: "jpg",
      seed: direction.seed,
    });
  const language = ctx.language ?? "en";
  const url = await runObservedCreativePrediction(
    {
      model,
      promptVersion: `cover-v2.${language}`,
      briefVersion: ctx.briefVersion ?? 0,
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
  if (!response.ok) throw new Error(`cover download failed (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("cover download returned empty bytes");
  return await deps.put(key, bytes, "image/jpeg", "public");
}

export async function generateCoverImage(
  key: string,
  ctx: CoverContext,
): Promise<string> {
  const { r2Put } = await import("./r2.ts");
  return await generateCoverAsset(key, ctx, {
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
