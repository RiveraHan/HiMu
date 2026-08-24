import type { ModelDefinition } from "./creative-models.ts";

export type CreativeTextRequest = {
  system: string;
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
};

export type CreativeImageRequest = {
  prompt: string;
  aspectRatio: "1:1";
  outputFormat: "jpg";
  seed?: number;
};

function validTextRequest(
  model: ModelDefinition,
  request: CreativeTextRequest,
): void {
  if (
    request.system.trim().length === 0 || request.prompt.trim().length === 0 ||
    !Number.isInteger(request.maxOutputTokens) || request.maxOutputTokens < 1 ||
    request.maxOutputTokens > model.limits.output ||
    !Number.isFinite(request.temperature) || request.temperature < 0 ||
    request.temperature > 2
  ) {
    throw new Error("creative_text_request");
  }
}

export function buildTextProviderBody(
  model: ModelDefinition,
  request: CreativeTextRequest,
): Record<string, unknown> {
  validTextRequest(model, request);
  const common = {
    system_prompt: request.system,
    prompt: request.prompt,
  };
  if (model.adapter === "llama") {
    return {
      input: {
        ...common,
        max_tokens: request.maxOutputTokens,
        temperature: request.temperature,
      },
    };
  }
  if (model.adapter === "anthropic") {
    return {
      input: {
        ...common,
        max_tokens: request.maxOutputTokens,
        temperature: request.temperature,
        effort: "low",
      },
    };
  }
  if (model.adapter === "openai") {
    return {
      input: {
        ...common,
        max_completion_tokens: request.maxOutputTokens,
        temperature: request.temperature,
        reasoning_effort: "none",
        verbosity: "low",
      },
    };
  }
  if (model.adapter === "gemini") {
    return {
      input: {
        system_instruction: request.system,
        prompt: request.prompt,
        max_output_tokens: request.maxOutputTokens,
        temperature: request.temperature,
        thinking_level: "none",
      },
    };
  }
  throw new Error("creative_text_adapter");
}

function validImageRequest(request: CreativeImageRequest): void {
  if (
    request.prompt.trim().length === 0 || request.prompt.length > 4_000 ||
    request.aspectRatio !== "1:1" || request.outputFormat !== "jpg" ||
    (request.seed != null &&
      (!Number.isSafeInteger(request.seed) || request.seed < 0 || request.seed > 2_147_483_647))
  ) {
    throw new Error("creative_image_request");
  }
}

export function buildImageProviderBody(
  model: ModelDefinition,
  request: CreativeImageRequest,
): Record<string, unknown> {
  validImageRequest(request);
  if (model.adapter === "gpt_image") {
    return {
      input: {
        prompt: request.prompt,
        aspect_ratio: request.aspectRatio,
        output_format: "jpeg",
        quality: "low",
        background: "opaque",
        moderation: "auto",
        number_of_images: 1,
        output_compression: 92,
      },
    };
  }
  if (model.adapter === "reve") {
    return {
      input: {
        prompt: request.prompt,
        aspect_ratio: request.aspectRatio,
        version: "latest",
        ...(request.seed == null ? {} : { seed: request.seed }),
      },
    };
  }
  if (model.adapter === "flux") {
    const klein = model.id === "black-forest-labs/flux-2-klein-9b";
    return {
      input: {
        prompt: request.prompt,
        aspect_ratio: request.aspectRatio,
        output_format: "jpg",
        output_quality: 92,
        ...(klein
          ? { output_megapixels: "1", disable_safety_checker: false }
          : { safety_tolerance: 2, prompt_upsampling: false }),
        ...(request.seed == null ? {} : { seed: request.seed }),
      },
    };
  }
  throw new Error("creative_image_adapter");
}
