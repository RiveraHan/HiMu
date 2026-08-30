import {
  ExperienceStateConflictError,
  handleExperienceStateRequest,
} from "./handler.ts";
import type { ExperienceAction } from "../../../shared/experience-action.ts";

type RpcError = { code?: string | null };

export type ExperienceStateAdapterDependencies = {
  rpc(
    functionName: "transition_user_experience" | "claim_user_preference_nudge",
    args: {
      p_user_id: string;
      p_action: ExperienceAction["action"];
      p_intro_version: number | null;
      p_track_id: string | null;
    } | {
      p_user_id: string;
      p_track_id: string;
    },
  ): Promise<{ data: unknown; error: RpcError | null }>;
};

type ExperienceStateHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

function isStateConflict(error: RpcError): boolean {
  return error.code === "P0001" || error.code === "23505";
}

async function transitionExperienceState(
  userId: string,
  action: ExperienceAction["action"],
  introVersion: number | null,
  trackId: string | null,
  deps: ExperienceStateAdapterDependencies,
): Promise<unknown> {
  if (action === "claim_nudge" && trackId) {
    const { data, error } = await deps.rpc("claim_user_preference_nudge", {
      p_user_id: userId,
      p_track_id: trackId,
    });
    if (error) {
      if (isStateConflict(error)) throw new ExperienceStateConflictError();
      throw new Error("experience_state_transition_failed");
    }
    return Array.isArray(data) ? data[0] : data;
  }

  const { data, error } = await deps.rpc("transition_user_experience", {
    p_user_id: userId,
    p_action: action,
    p_intro_version: introVersion,
    p_track_id: trackId,
  });
  if (error) {
    if (isStateConflict(error)) throw new ExperienceStateConflictError();
    throw new Error("experience_state_transition_failed");
  }

  const state = Array.isArray(data) ? data[0] : data;
  return { state, applied: true };
}

export async function handleExperienceStateHttpRequest(
  req: Pick<Request, "method" | "json">,
  userId: string,
  deps: ExperienceStateAdapterDependencies,
): Promise<ExperienceStateHttpResult> {
  if (req.method !== "POST") {
    return { status: 400, body: { error: "invalid_input", code: "invalid_input" } };
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { status: 400, body: { error: "invalid_input", code: "invalid_input" } };
  }

  const result = await handleExperienceStateRequest(body, userId, {
    transition: (verifiedUserId, action, introVersion, trackId) =>
      transitionExperienceState(
        verifiedUserId,
        action,
        introVersion,
        trackId,
        deps,
      ),
  });
  return result;
}
