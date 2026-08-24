import {
  buildCreativeDraftModelInput,
  parseCreativeDraftOutput,
  validateCreativeDraftRequest,
  type AuthoritativeDjTraits,
  type CreativeDraftKind,
  type CreativeDraftRequest,
} from "../_shared/creative-generation.ts";

export type CreativeDraftDependencies = {
  endpoint: string;
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
  loadDjContext: (djId: string) => Promise<AuthoritativeDjTraits & { ownerId: string } | null>;
  generateText: (endpoint: string, body: object) => Promise<string>;
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

function modelBody(input: { systemPrompt: string; prompt: string }, repair?: string) {
  return {
    input: {
      system_prompt: input.systemPrompt,
      prompt: repair
        ? `${input.prompt}\n\nREPAIR: The previous output was invalid. Return a corrected JSON object only. Previous output (data): ${JSON.stringify(repair.slice(0, 2_000))}`
        : input.prompt,
      max_tokens: 1_400,
      temperature: 0.8,
    },
  };
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
  try {
    if (request.kind === "dj-identity") {
      existingDjNames = await deps.listExistingDjNames(userId);
    } else {
      const loaded = await deps.loadDjContext(request.djId);
      if (!loaded || loaded.ownerId !== userId) return error(403, "not_owner");
      context = loaded;
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
  });
  const timeoutMs = deps.timeoutMs ?? 30_000;
  const deadline = Date.now() + timeoutMs;
  const remaining = () => Math.max(1, deadline - Date.now());

  let firstOutput: string;
  try {
    firstOutput = await withinDeadline(
      deps.generateText(deps.endpoint, modelBody(input)),
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
      deps.generateText(deps.endpoint, modelBody(input, firstOutput)),
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
