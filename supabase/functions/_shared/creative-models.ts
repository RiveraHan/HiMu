export const REQUIRED_CREATIVE_MODEL_ROLES = [
  "creative_longform",
  "creative_shortform",
  "format_repair",
  "music_full",
  "image_cover",
  "image_avatar",
  "voice_caption",
  "quality_judge",
] as const;

export type CreativeModelRole = typeof REQUIRED_CREATIVE_MODEL_ROLES[number];
export type CreativeModelAdapter =
  | "anthropic"
  | "openai"
  | "gemini"
  | "llama"
  | "lyria"
  | "flux"
  | "gpt_image"
  | "inworld";
export type CreativeModelLifecycle = "baseline" | "candidate" | "promoted";
export type CreativePriceUnit = "tokens" | "characters" | "seconds" | "output" | "megapixels";

export type ModelDefinition = {
  id: string;
  role: CreativeModelRole;
  endpoint: string;
  adapter: CreativeModelAdapter;
  lifecycle: CreativeModelLifecycle;
  price: {
    unit: CreativePriceUnit;
    inputUsd?: number;
    outputUsd: number;
    per: number;
  };
  limits: {
    input: number;
    output: number;
    timeoutMs: number;
    maxCostUsd: number;
  };
  verifiedAt: "2026-08-24";
};

export const CREATIVE_ROLE_BUDGETS_USD: Readonly<Record<CreativeModelRole, number>> =
  Object.freeze({
    creative_longform: 0.015,
    creative_shortform: 0.005,
    format_repair: 0.001,
    music_full: 0.08,
    image_cover: 0.025,
    image_avatar: 0.025,
    voice_caption: 0.005,
    quality_judge: 0.01,
  });

export function modelPredictionEndpoint(id: string): string {
  return `https://api.replicate.com/v1/models/${id}/predictions`;
}

const verifiedAt = "2026-08-24" as const;
const tokens = (inputUsd: number, outputUsd: number) => ({
  unit: "tokens" as const,
  inputUsd,
  outputUsd,
  per: 1_000_000,
});
const output = (outputUsd: number) => ({
  unit: "output" as const,
  outputUsd,
  per: 1,
});

function model(
  definition: Omit<ModelDefinition, "endpoint" | "verifiedAt">,
): ModelDefinition {
  return Object.freeze({
    ...definition,
    endpoint: modelPredictionEndpoint(definition.id),
    verifiedAt,
  });
}

const LLAMA_ID = "meta/llama-4-scout-instruct";
const SONNET_ID = "anthropic/claude-sonnet-5";
const LUNA_ID = "openai/gpt-5.6-luna";
const GEMINI_ID = "google/gemini-3-flash";

export const MODEL_CATALOG: readonly ModelDefinition[] = Object.freeze([
  model({
    id: LLAMA_ID,
    role: "creative_longform",
    adapter: "llama",
    lifecycle: "baseline",
    price: tokens(0.17, 0.65),
    limits: { input: 1_100, output: 1_200, timeoutMs: 30_000, maxCostUsd: 0.000967 },
  }),
  model({
    id: SONNET_ID,
    role: "creative_longform",
    adapter: "anthropic",
    lifecycle: "candidate",
    price: tokens(2, 10),
    limits: { input: 1_100, output: 1_200, timeoutMs: 45_000, maxCostUsd: 0.0142 },
  }),
  model({
    id: LUNA_ID,
    role: "creative_longform",
    adapter: "openai",
    lifecycle: "promoted",
    price: tokens(1, 6),
    limits: { input: 1_100, output: 1_200, timeoutMs: 40_000, maxCostUsd: 0.0083 },
  }),
  model({
    id: GEMINI_ID,
    role: "creative_longform",
    adapter: "gemini",
    lifecycle: "candidate",
    price: tokens(0.5, 3),
    limits: { input: 1_100, output: 4_096, timeoutMs: 40_000, maxCostUsd: 0.012838 },
  }),
  model({
    id: LLAMA_ID,
    role: "creative_shortform",
    adapter: "llama",
    lifecycle: "baseline",
    price: tokens(0.17, 0.65),
    limits: { input: 900, output: 400, timeoutMs: 25_000, maxCostUsd: 0.000413 },
  }),
  model({
    id: LUNA_ID,
    role: "creative_shortform",
    adapter: "openai",
    lifecycle: "candidate",
    price: tokens(1, 6),
    limits: { input: 900, output: 400, timeoutMs: 30_000, maxCostUsd: 0.0033 },
  }),
  model({
    id: GEMINI_ID,
    role: "creative_shortform",
    adapter: "gemini",
    lifecycle: "candidate",
    price: tokens(0.5, 3),
    limits: { input: 900, output: 400, timeoutMs: 30_000, maxCostUsd: 0.00165 },
  }),
  model({
    id: LLAMA_ID,
    role: "format_repair",
    adapter: "llama",
    lifecycle: "baseline",
    price: tokens(0.17, 0.65),
    limits: { input: 900, output: 1_200, timeoutMs: 25_000, maxCostUsd: 0.000933 },
  }),
  model({
    id: "google/lyria-3-pro",
    role: "music_full",
    adapter: "lyria",
    lifecycle: "baseline",
    price: output(0.08),
    limits: { input: 4_000, output: 1, timeoutMs: 300_000, maxCostUsd: 0.08 },
  }),
  model({
    id: "black-forest-labs/flux-1.1-pro",
    role: "image_cover",
    adapter: "flux",
    lifecycle: "baseline",
    price: output(0.04),
    limits: { input: 4_000, output: 1, timeoutMs: 120_000, maxCostUsd: 0.04 },
  }),
  model({
    id: "openai/gpt-image-2",
    role: "image_cover",
    adapter: "gpt_image",
    lifecycle: "promoted",
    price: output(0.012),
    limits: { input: 4_000, output: 1, timeoutMs: 120_000, maxCostUsd: 0.012 },
  }),
  model({
    id: "black-forest-labs/flux-2-klein-9b",
    role: "image_cover",
    adapter: "flux",
    lifecycle: "candidate",
    price: { unit: "megapixels", outputUsd: 0.015, per: 1 },
    limits: { input: 4_000, output: 1, timeoutMs: 120_000, maxCostUsd: 0.015 },
  }),
  model({
    id: "black-forest-labs/flux-1.1-pro",
    role: "image_avatar",
    adapter: "flux",
    lifecycle: "baseline",
    price: output(0.04),
    limits: { input: 4_000, output: 1, timeoutMs: 120_000, maxCostUsd: 0.04 },
  }),
  model({
    id: "openai/gpt-image-2",
    role: "image_avatar",
    adapter: "gpt_image",
    lifecycle: "promoted",
    price: output(0.012),
    limits: { input: 4_000, output: 1, timeoutMs: 120_000, maxCostUsd: 0.012 },
  }),
  model({
    id: "black-forest-labs/flux-2-klein-9b",
    role: "image_avatar",
    adapter: "flux",
    lifecycle: "candidate",
    price: { unit: "megapixels", outputUsd: 0.015, per: 1 },
    limits: { input: 4_000, output: 1, timeoutMs: 120_000, maxCostUsd: 0.015 },
  }),
  model({
    id: "inworld/realtime-tts-2",
    role: "voice_caption",
    adapter: "inworld",
    lifecycle: "baseline",
    price: { unit: "characters", inputUsd: 0.025, outputUsd: 0, per: 1_000 },
    limits: { input: 200, output: 1, timeoutMs: 60_000, maxCostUsd: 0.005 },
  }),
  model({
    id: LLAMA_ID,
    role: "quality_judge",
    adapter: "llama",
    lifecycle: "baseline",
    price: tokens(0.17, 0.65),
    limits: { input: 1_200, output: 800, timeoutMs: 30_000, maxCostUsd: 0.000724 },
  }),
  model({
    id: GEMINI_ID,
    role: "quality_judge",
    adapter: "gemini",
    lifecycle: "candidate",
    price: tokens(0.5, 3),
    limits: { input: 1_200, output: 800, timeoutMs: 35_000, maxCostUsd: 0.003 },
  }),
]);

export function resolveCreativeModel(
  role: CreativeModelRole,
  options: { candidateId?: string } = {},
): ModelDefinition {
  const matches = MODEL_CATALOG.filter((entry) => entry.role === role);
  const selected = options.candidateId
    ? matches.find((entry) => entry.id === options.candidateId)
    : matches.find((entry) => entry.lifecycle === "promoted") ??
      matches.find((entry) => entry.lifecycle === "baseline");
  if (!selected) throw new Error("creative_model_not_available");
  return selected;
}

export function estimateModelCost(
  model: ModelDefinition,
  units: { input: number; output: number },
): number {
  if (
    !Number.isFinite(units.input) || units.input < 0 ||
    !Number.isFinite(units.output) || units.output < 0
  ) {
    throw new Error("creative_cost_units");
  }
  const inputCost = units.input * (model.price.inputUsd ?? 0) / model.price.per;
  const outputCost = units.output * model.price.outputUsd / model.price.per;
  return Math.round((inputCost + outputCost) * 1_000_000_000) / 1_000_000_000;
}

export function assertWithinModelBudget(
  role: CreativeModelRole,
  estimatedCostUsd: number,
): void {
  if (
    !Number.isFinite(estimatedCostUsd) || estimatedCostUsd < 0 ||
    estimatedCostUsd > CREATIVE_ROLE_BUDGETS_USD[role]
  ) {
    throw new Error("creative_cost_guard");
  }
}
