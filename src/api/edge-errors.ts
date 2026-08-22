import { FunctionsHttpError } from "@supabase/supabase-js";

export type EdgeErrorPayload = {
  code: string | null;
  dailyLimit: number | null;
  limit: number | null;
};

const EMPTY_PAYLOAD: EdgeErrorPayload = {
  code: null,
  dailyLimit: null,
  limit: null,
};

function positiveInteger(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) > 0
    ? (value as number)
    : null;
}

export async function getEdgeErrorPayload(
  error: unknown,
): Promise<EdgeErrorPayload> {
  if (!(error instanceof FunctionsHttpError)) return EMPTY_PAYLOAD;

  try {
    const body = await error.context.json();

    return {
      code: typeof body?.code === "string" ? body.code : null,
      dailyLimit: positiveInteger(body?.dailyLimit),
      limit: positiveInteger(body?.limit),
    };
  } catch {
    return EMPTY_PAYLOAD;
  }
}

export async function getEdgeErrorCode(error: unknown): Promise<string | null> {
  return (await getEdgeErrorPayload(error)).code;
}
