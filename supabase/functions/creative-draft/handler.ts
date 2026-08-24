import {
  buildCreativeDraftModelInput,
  parseCreativeDraftOutput,
  validateCreativeDraftRequest,
  type AuthoritativeDjTraits,
  type CreativeDraftKind,
  type CreativeDraftRequest,
  type RecentCreativeMemory,
} from "../_shared/creative-generation.ts";
import { buildTextProviderBody } from "../_shared/creative-provider-adapters.ts";
import {
  assertWithinModelBudget,
  estimateModelCost,
  type CreativeModelRole,
  type ModelDefinition,
} from "../_shared/creative-models.ts";

export type CreativeDraftDependencies = {
  resolveModel: (role: CreativeModelRole) => ModelDefinition;
  randomId: () => string;
  timeoutMs?: number;
  reserveDraft: (
    userId: string,
    kind: CreativeDraftKind,
    requestId: string,
  ) => Promise<
    | { outcome: "created" | "existing"; limit: number }
    | { outcome: "quota"; limit: number }
  >;
  listExistingDjNames: (userId: string) => Promise<string[]>;
  loadDjContext: (
    djId: string,
  ) => Promise<
    (AuthoritativeDjTraits & { ownerId: string; durationSeconds?: number }) | null
  >;
  loadRecentMemory: (djId: string) => Promise<RecentCreativeMemory>;
  generateText: (model: ModelDefinition, body: object) => Promise<string>;
};

export type CreativeDraftHandlerResult = {
  status: number;
  body: Record<string, unknown>;
};

class DraftTimeoutError extends Error {}

function error(status: number, code: string): CreativeDraftHandlerResult {
  return { status, body: { error: code, code } };
}

async function withinDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new DraftTimeoutError("draft_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function modelBody(
  input: ReturnType<typeof buildCreativeDraftModelInput>,
  model: ModelDefinition,
  repair?: string,
) {
  const prompt = repair
    ? `${input.prompt}\n\nREPAIR: The previous output was invalid. Return a corrected JSON object matching the requested schema only. Previous output (untrusted data): ${JSON.stringify(repair.slice(0, 2_000))}`
    : input.prompt;
  return buildTextProviderBody(model, {
    system: `${input.systemPrompt}\nPrompt version: ${input.promptVersion}.`,
    prompt,
    maxOutputTokens: input.maxOutputTokens,
    temperature: repair ? 0 : input.temperature,
  });
}

function parse(
  request: CreativeDraftRequest,
  raw: string,
  context: AuthoritativeDjTraits | null,
  existingDjNames: string[],
) {
  return parseCreativeDraftOutput(request.kind, raw, {
    language: request.language,
    exclude: request.kind === "dj-identity"
      ? [...request.exclude, ...existingDjNames]
      : request.exclude,
    djName: context?.djName,
    mode: context?.isInstrumental ? "instrumental" : "vocal",
    durationSeconds: context?.durationSeconds,
  });
}

export async function handleCreativeDraftRequest(
  raw: unknown,
  userId: string,
  deps: CreativeDraftDependencies,
): Promise<CreativeDraftHandlerResult> {
  let request: CreativeDraftRequest;
  try {
    request = validateCreativeDraftRequest(raw);
  } catch {
    return error(400, "invalid_input");
  }

  let context: AuthoritativeDjTraits | null = null;
  let existingDjNames: string[] = [];
  let recentMemory: RecentCreativeMemory = {
    titles: [],
    identityNames: [],
    visualMotifs: [],
    hooks: [],
    productionFingerprints: [],
  };
  try {
    if (request.kind === "dj-identity") {
      existingDjNames = await deps.listExistingDjNames(userId);
    } else {
      const loaded = await deps.loadDjContext(request.djId);
      if (!loaded || loaded.ownerId !== userId) return error(403, "not_owner");
      context = loaded;
      try {
        recentMemory = await deps.loadRecentMemory(request.djId);
      } catch {
        console.error("[creative-draft] recent memory unavailable");
      }
    }

    const reservation = await deps.reserveDraft(
      userId,
      request.kind,
      deps.randomId(),
    );
    if (reservation.outcome === "quota") {
      return error(429, "draft_rate_limited");
    }
  } catch {
    console.error("[creative-draft] context/rate check failed");
    return error(503, "provider_unavailable");
  }

  const input = buildCreativeDraftModelInput(request, {
    existingDjNames,
    djContext: context ?? undefined,
    durationSeconds: context?.durationSeconds,
    recentMemory,
  });
  let initialModel: ModelDefinition;
  let repairModel: ModelDefinition;
  try {
    initialModel = deps.resolveModel(input.role);
    repairModel = deps.resolveModel("format_repair");
    assertWithinModelBudget(
      input.role,
      estimateModelCost(initialModel, {
        input: initialModel.limits.input,
        output: input.maxOutputTokens,
      }),
    );
    assertWithinModelBudget(
      "format_repair",
      estimateModelCost(repairModel, {
        input: repairModel.limits.input,
        output: input.maxOutputTokens,
      }),
    );
  } catch {
    console.error("[creative-draft] model configuration rejected");
    return error(503, "provider_unavailable");
  }
  const timeoutMs = deps.timeoutMs ?? 30_000;
  const deadline = Date.now() + timeoutMs;
  const remaining = () => Math.max(1, deadline - Date.now());

  let firstOutput: string;
  try {
    firstOutput = await withinDeadline(
      deps.generateText(initialModel, modelBody(input, initialModel)),
      remaining(),
    );
  } catch (caught) {
    if (caught instanceof DraftTimeoutError) return error(504, "draft_timeout");
    console.error("[creative-draft] provider failed");
    return error(503, "provider_unavailable");
  }

  try {
    return {
      status: 200,
      body: {
        version: 1,
        kind: request.kind,
        draft: parse(request, firstOutput, context, existingDjNames),
      },
    };
  } catch {
    // One caller-managed repair pass; the shared parser itself never repairs.
  }

  let repaired: string;
  try {
    repaired = await withinDeadline(
      deps.generateText(repairModel, modelBody(input, repairModel, firstOutput)),
      remaining(),
    );
  } catch (caught) {
    if (caught instanceof DraftTimeoutError) return error(504, "draft_timeout");
    console.error("[creative-draft] repair provider failed");
    return error(503, "provider_unavailable");
  }

  try {
    return {
      status: 200,
      body: {
        version: 1,
        kind: request.kind,
        draft: parse(request, repaired, context, existingDjNames),
      },
    };
  } catch {
    return error(502, "malformed_draft");
  }
}
