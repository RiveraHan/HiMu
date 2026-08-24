import { buildImageProviderBody } from "./creative-provider-adapters.ts";
import {
  assertWithinModelBudget,
  estimateModelCost,
  resolveCreativeModel,
} from "./creative-models.ts";
import {
  compileVisualDirection,
  renderVisualPrompt,
  type VisualPlan,
} from "./visual-direction.ts";
import { r2Put } from "./r2.ts";
import { replicateRun } from "./replicate.ts";

export type CoverContext = {
  genre: string;
  moods: string[];
  instrumental: boolean;
  seed?: string;
  visualPlan?: VisualPlan | null;
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

export async function generateCoverImage(
  key: string,
  ctx: CoverContext,
): Promise<string> {
  const model = resolveCreativeModel("image_cover");
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
  const url = await replicateRun(
    model.endpoint,
    buildImageProviderBody(model, {
      prompt: renderVisualPrompt(direction),
      aspectRatio: "1:1",
      outputFormat: "jpg",
      seed: direction.seed,
    }),
  );
  const response = await fetch(url);
  if (!response.ok) throw new Error(`cover download failed (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("cover download returned empty bytes");
  return await r2Put(key, bytes, "image/jpeg", "public");
}
