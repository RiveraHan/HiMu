export type NormalizedPrediction<T> = {
  output: T;
  predictionId: string;
  modelId: string;
  startedAt: string | null;
  completedAt: string | null;
  metrics: {
    inputTokens: number | null;
    outputTokens: number | null;
    inputCharacters: number | null;
    outputSeconds: number | null;
    predictSeconds: number | null;
  };
};

type PredictionStatus =
  | "starting"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

type RawPrediction = {
  id?: unknown;
  model?: unknown;
  status?: unknown;
  urls?: { get?: unknown };
  output?: unknown;
  error?: unknown;
  retry_after?: unknown;
  created_at?: unknown;
  started_at?: unknown;
  completed_at?: unknown;
  metrics?: Record<string, unknown> | null;
};

type RunnerOptions = {
  token?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
  maxPolls?: number;
  maxRateRetries?: number;
};

const TERMINAL = new Set<PredictionStatus>(["succeeded", "failed", "canceled"]);
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function tokenFromEnvironment(): string {
  const token = typeof Deno === "undefined"
    ? ""
    : Deno.env.get("REPLICATE_API_TOKEN") ?? "";
  if (token.length === 0) throw new Error("Replicate token unavailable");
  return token;
}

async function readPrediction(response: Response): Promise<RawPrediction> {
  try {
    const value = await response.json();
    return value != null && typeof value === "object" && !Array.isArray(value)
      ? value as RawPrediction
      : {};
  } catch {
    return {};
  }
}

function retryAfterSeconds(prediction: RawPrediction): number {
  return typeof prediction.retry_after === "number" &&
      Number.isFinite(prediction.retry_after) && prediction.retry_after >= 0
    ? prediction.retry_after
    : 3;
}

async function createPrediction(
  endpoint: string,
  body: object,
  options: Required<Pick<RunnerOptions, "token" | "fetchImpl" | "sleep" | "maxRateRetries">>,
): Promise<RawPrediction> {
  for (let attempt = 0; attempt <= options.maxRateRetries; attempt++) {
    const response = await options.fetchImpl(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify(body),
    });
    const prediction = await readPrediction(response);
    if (response.status === 429 && attempt < options.maxRateRetries) {
      await options.sleep((retryAfterSeconds(prediction) + 1) * 1_000);
      continue;
    }
    if (!response.ok) {
      throw new Error(`Replicate (${response.status}): request failed`);
    }
    return prediction;
  }
  throw new Error("Replicate rate limited");
}

function predictionStatus(value: unknown): PredictionStatus {
  if (
    value === "starting" || value === "processing" || value === "succeeded" ||
    value === "failed" || value === "canceled"
  ) {
    return value;
  }
  throw new Error("Replicate invalid prediction");
}

function predictionUrl(prediction: RawPrediction): string {
  const value = prediction.urls?.get;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Replicate invalid prediction");
  }
  return value;
}

function nullableTimestamp(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function finiteMetric(metrics: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

function modelIdFromEndpoint(endpoint: string): string {
  const match = endpoint.match(/\/models\/([^/]+\/[^/]+)\/predictions(?:\?|$)/);
  return match?.[1] ?? "unknown";
}

function normalizePrediction<T>(
  prediction: RawPrediction,
  endpoint: string,
  parseOutput: (output: unknown) => T,
): NormalizedPrediction<T> {
  if (typeof prediction.id !== "string" || prediction.id.length === 0) {
    throw new Error("Replicate invalid prediction");
  }
  const metrics = prediction.metrics ?? {};
  return {
    output: parseOutput(prediction.output),
    predictionId: prediction.id,
    modelId: typeof prediction.model === "string" && prediction.model.length > 0
      ? prediction.model
      : modelIdFromEndpoint(endpoint),
    startedAt: nullableTimestamp(prediction.started_at),
    completedAt: nullableTimestamp(prediction.completed_at),
    metrics: {
      inputTokens: finiteMetric(metrics, ["input_token_count", "input_tokens"]),
      outputTokens: finiteMetric(metrics, ["output_token_count", "output_tokens"]),
      inputCharacters: finiteMetric(metrics, [
        "character_input_count",
        "input_character_count",
        "input_characters",
      ]),
      outputSeconds: finiteMetric(metrics, [
        "output_duration",
        "audio_duration",
        "output_seconds",
      ]),
      predictSeconds: finiteMetric(metrics, ["predict_time", "predict_seconds"]),
    },
  };
}

export async function replicatePrediction<T>(
  endpoint: string,
  body: object,
  parseOutput: (output: unknown) => T,
  options: RunnerOptions = {},
): Promise<NormalizedPrediction<T>> {
  const token = options.token ?? tokenFromEnvironment();
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const pollIntervalMs = options.pollIntervalMs ?? 1_500;
  const maxPolls = options.maxPolls ?? 80;
  const predictionOptions = {
    token,
    fetchImpl,
    sleep,
    maxRateRetries: options.maxRateRetries ?? 10,
  };
  let prediction = await createPrediction(endpoint, body, predictionOptions);
  let status = predictionStatus(prediction.status);

  let polls = 0;
  while (!TERMINAL.has(status) && polls < maxPolls) {
    await sleep(pollIntervalMs);
    const response = await fetchImpl(predictionUrl(prediction), {
      headers: { Authorization: `Bearer ${token}` },
    });
    prediction = await readPrediction(response);
    if (!response.ok) {
      throw new Error(`Replicate (${response.status}): poll failed`);
    }
    status = predictionStatus(prediction.status);
    polls += 1;
  }

  if (!TERMINAL.has(status)) throw new Error("Replicate timeout");
  if (status !== "succeeded") {
    throw new Error(`Replicate ${status}: prediction failed`);
  }
  return normalizePrediction(prediction, endpoint, parseOutput);
}

export function parseReplicateMediaOutput(output: unknown): string {
  const value = typeof output === "string"
    ? output
    : Array.isArray(output) && typeof output[0] === "string"
    ? output[0]
    : null;
  if (!value) throw new Error("replicate_media_output");
  return value;
}

export function parseReplicateTextOutput(output: unknown): string {
  const value = typeof output === "string"
    ? output
    : Array.isArray(output) && output.every((item) => typeof item === "string")
    ? output.join("")
    : null;
  if (value == null) throw new Error("replicate_text_output");
  return value;
}

export function replicateMediaPrediction(
  endpoint: string,
  body: object,
  options: RunnerOptions = {},
): Promise<NormalizedPrediction<string>> {
  return replicatePrediction(endpoint, body, parseReplicateMediaOutput, options);
}

export function replicateTextPrediction(
  endpoint: string,
  body: object,
  options: RunnerOptions = {},
): Promise<NormalizedPrediction<string>> {
  return replicatePrediction(endpoint, body, parseReplicateTextOutput, options);
}

// Compatibility wrappers for callers that do not yet consume provider metadata.
export async function replicateRun(endpoint: string, body: object): Promise<string> {
  const prediction = await replicateMediaPrediction(endpoint, body, {
    pollIntervalMs: 3_000,
    maxPolls: 80,
  });
  return prediction.output;
}

export async function replicateText(endpoint: string, body: object): Promise<string> {
  const prediction = await replicateTextPrediction(endpoint, body, {
    pollIntervalMs: 1_500,
    maxPolls: 40,
  });
  return prediction.output;
}
