import { FunctionsHttpError } from "@supabase/supabase-js";

// Our edge functions return { error, code } on failures; read the code.
export async function getEdgeErrorCode(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;

  try {
    const body = await error.context.json();

    return typeof body?.code === "string" ? body.code : null;
  } catch {
    return null;
  }
}
