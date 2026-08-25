import { json } from "../_shared/http.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";
import {
  ExperienceStateConflictError,
  handleExperienceStateRequest,
  type ExperienceStateDependencies,
} from "./handler.ts";

const dependencies: ExperienceStateDependencies = {
  transition: async (userId, action, introVersion, trackId) => {
    const { data, error } = await admin.rpc("transition_user_experience", {
      p_user_id: userId,
      p_action: action,
      p_intro_version: introVersion,
      p_track_id: trackId,
    });
    if (error) {
      if (error.code === "P0001" || error.code === "23505") {
        throw new ExperienceStateConflictError();
      }
      throw new Error("experience_state_transition_failed");
    }

    const state = Array.isArray(data) ? data[0] : data;
    if (!state) throw new Error("experience_state_unavailable");
    return state;
  },
};

serveAuthed(async (req, user) => {
  if (req.method !== "POST") {
    return json({ error: "invalid_input", code: "invalid_input" }, 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_input", code: "invalid_input" }, 400);
  }

  const result = await handleExperienceStateRequest(body, user.id, dependencies);
  return json(result.status === 200 ? { state: result.body } : result.body, result.status);
});
