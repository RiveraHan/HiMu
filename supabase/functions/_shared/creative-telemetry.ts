import {
  REQUIRED_CREATIVE_MODEL_ROLES,
  estimateModelCost,
  type CreativeModelRole,
  type ModelDefinition,
} from "./creative-models.ts";
import type { NormalizedPrediction } from "./replicate.ts";

export type CreativeUsageEvent = {
  role: CreativeModelRole;
  modelId: string;
  status: "succeeded" | "failed" | "rejected";
  promptVersion: string;
  briefVersion: 0 | 1 | 2;
  language: "en" | "es";
  outcome: string;
  repaired: boolean;
  latencyMs: number;
  estimatedCostUsd: number;
  inputUnits: number | null;
  outputUnits: number | null;
};

export type CreativePredictionContext = {
  model: ModelDefinition;
  promptVersion: string;
  briefVersion: 0 | 1 | 2;
  language: "en" | "es";
  outcome: string;
  repaired: boolean;
  fallbackUnits?: { input?: number; output?: number };
};

const EVENT_KEYS = [
  "role",
  "modelId",
  "status",
  "promptVersion",
  "briefVersion",
  "language",
  "outcome",
  "repaired",
  "latencyMs",
  "estimatedCostUsd",
  "inputUnits",
  "outputUnits",
] as const;
const MODEL_ID = /^[a-z0-9-]+\/[a-z0-9.-]+$/;
const STABLE_LABEL = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function nonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function nullableUnits(value: unknown): value is number | null {
  return value === null || (Number.isSafeInteger(value) && Number(value) >= 0);
}

export function createCreativeUsageEvent(value: unknown): CreativeUsageEvent {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("creative_usage_event");
  }
  const input = value as Record<string, unknown>;
  const keys = Object.keys(input).sort();
  const expected = [...EVENT_KEYS].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index]) ||
    !REQUIRED_CREATIVE_MODEL_ROLES.includes(input.role as CreativeModelRole) ||
    typeof input.modelId !== "string" || !MODEL_ID.test(input.modelId) ||
    (input.status !== "succeeded" && input.status !== "failed" && input.status !== "rejected") ||
    typeof input.promptVersion !== "string" || !STABLE_LABEL.test(input.promptVersion) ||
    (input.briefVersion !== 0 && input.briefVersion !== 1 && input.briefVersion !== 2) ||
    (input.language !== "en" && input.language !== "es") ||
    typeof input.outcome !== "string" || !STABLE_LABEL.test(input.outcome) ||
    typeof input.repaired !== "boolean" ||
    !Number.isSafeInteger(input.latencyMs) || Number(input.latencyMs) < 0 ||
    !nonNegativeNumber(input.estimatedCostUsd) ||
    !nullableUnits(input.inputUnits) || !nullableUnits(input.outputUnits)
  ) {
    throw new Error("creative_usage_event");
  }
  return {
    role: input.role as CreativeModelRole,
    modelId: input.modelId,
    status: input.status,
    promptVersion: input.promptVersion,
    briefVersion: input.briefVersion,
    language: input.language,
    outcome: input.outcome,
    repaired: input.repaired,
    latencyMs: input.latencyMs,
    estimatedCostUsd: input.estimatedCostUsd,
    inputUnits: input.inputUnits,
    outputUnits: input.outputUnits,
  };
}

export function estimatePredictionCost(
  model: ModelDefinition,
  prediction: NormalizedPrediction<unknown>,
  fallback: { input?: number; output?: number } = {},
): number {
  switch (model.price.unit) {
    case "tokens":
      return estimateModelCost(model, {
        input: prediction.metrics.inputTokens ?? fallback.input ?? 0,
        output: prediction.metrics.outputTokens ?? fallback.output ?? 0,
      });
    case "characters":
      return estimateModelCost(model, {
        input: prediction.metrics.inputCharacters ?? fallback.input ?? 0,
        output: 0,
      });
    case "seconds":
      return estimateModelCost(model, {
        input: fallback.input ?? 0,
        output: prediction.metrics.outputSeconds ?? fallback.output ?? 0,
      });
    case "output":
      return estimateModelCost(model, { input: 0, output: fallback.output ?? 1 });
    case "megapixels":
      return estimateModelCost(model, { input: fallback.input ?? 0, output: fallback.output ?? 1 });
  }
}

export function logCreativeUsageEvent(
  value: unknown,
  logger: (line: string) => void = console.info,
): void {
  const event = createCreativeUsageEvent(value);
  logger(`[creative_usage] ${JSON.stringify(event)}`);
}

function predictionUnits(
  model: ModelDefinition,
  prediction: NormalizedPrediction<unknown>,
  fallback: { input?: number; output?: number },
): { inputUnits: number | null; outputUnits: number | null } {
  switch (model.price.unit) {
    case "tokens":
      return {
        inputUnits: prediction.metrics.inputTokens,
        outputUnits: prediction.metrics.outputTokens,
      };
    case "characters":
      return {
        inputUnits: prediction.metrics.inputCharacters ?? fallback.input ?? null,
        outputUnits: null,
      };
    case "output":
    case "megapixels":
      return { inputUnits: null, outputUnits: fallback.output ?? 1 };
    case "seconds":
      return { inputUnits: null, outputUnits: null };
  }
}

function safelyRecordUsage(
  recordUsage: (event: CreativeUsageEvent) => void,
  event: CreativeUsageEvent,
): void {
  try {
    recordUsage(createCreativeUsageEvent(event));
  } catch {
    console.error("[creative-telemetry] usage recording failed");
  }
}

export async function runObservedCreativePrediction<T>(
  context: CreativePredictionContext,
  run: () => Promise<NormalizedPrediction<T>>,
  recordUsage: (event: CreativeUsageEvent) => void = logCreativeUsageEvent,
  now: () => number = Date.now,
): Promise<T> {
  const startedAt = now();
  let prediction: NormalizedPrediction<T>;
  try {
    prediction = await run();
  } catch (error) {
    const fallback = context.fallbackUnits ?? {};
    safelyRecordUsage(recordUsage, {
      role: context.model.role,
      modelId: context.model.id,
      status: "failed",
      promptVersion: context.promptVersion,
      briefVersion: context.briefVersion,
      language: context.language,
      outcome: "provider_error",
      repaired: context.repaired,
      latencyMs: Math.max(0, Math.round(now() - startedAt)),
      estimatedCostUsd: estimateModelCost(context.model, {
        input: fallback.input ?? context.model.limits.input,
        output: fallback.output ?? context.model.limits.output,
      }),
      inputUnits: null,
      outputUnits: null,
    });
    throw error;
  }

  const fallback = context.fallbackUnits ?? {};
  const units = predictionUnits(context.model, prediction, fallback);
  safelyRecordUsage(recordUsage, {
    role: context.model.role,
    modelId: context.model.id,
    status: "succeeded",
    promptVersion: context.promptVersion,
    briefVersion: context.briefVersion,
    language: context.language,
    outcome: context.outcome,
    repaired: context.repaired,
    latencyMs: Math.max(0, Math.round(now() - startedAt)),
    estimatedCostUsd: estimatePredictionCost(
      context.model,
      prediction,
      fallback,
    ),
    ...units,
  });
  return prediction.output;
}
