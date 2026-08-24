import { json } from "../_shared/http.ts";
import { r2PresignPrivateGet } from "../_shared/r2.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";
import { handlePrivateMediaUrlRequest } from "./handler.ts";

serveAuthed(async (req, user) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed", code: "method_not_allowed" }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_input", code: "invalid_input" }, 400);
  }

  const response = await handlePrivateMediaUrlRequest(body, user.id, {
    loadTrack: async (trackId) => {
      const { data, error } = await admin
        .from("tracks")
        .select("owner_id,is_public,audio_url")
        .eq("id", trackId)
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
          ownerId: data.owner_id,
          isPublic: data.is_public,
          audioRef: data.audio_url,
        }
        : null;
    },
    loadCaption: async (jobId) => {
      const { data, error } = await admin
        .from("generation_jobs")
        .select("user_id,caption_audio_url")
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw error;
      return data
        ? { userId: data.user_id, audioRef: data.caption_audio_url }
        : null;
    },
    signPrivateGet: r2PresignPrivateGet,
  });

  return json(response.body, response.status);
});
