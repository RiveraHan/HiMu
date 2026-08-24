import { json } from "../_shared/http.ts";
import { mapProviderReservation } from "../_shared/provider-usage.ts";
import { replicateTextPrediction } from "../_shared/replicate.ts";
import { resolveCreativeModel } from "../_shared/creative-models.ts";
import { extractRecentCreativeMemory } from "../_shared/creative-generation.ts";
import { logCreativeUsageEvent } from "../_shared/creative-telemetry.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";
import {
  handleCreativeDraftRequest,
  type CreativeDraftDependencies,
} from "./handler.ts";

const dependencies: CreativeDraftDependencies = {
  resolveModel: resolveCreativeModel,
  randomId: () => crypto.randomUUID(),
  reserveDraft: async (userId, kind, requestId) => {
    const { data, error } = await admin.rpc("reserve_creative_draft", {
      p_user_id: userId,
      p_kind: kind,
      p_request_id: requestId,
    });
    const reservation = mapProviderReservation(data, error);
    return reservation.outcome === "quota"
      ? { outcome: "quota" as const, limit: reservation.limit }
      : { outcome: reservation.outcome, limit: reservation.limit };
  },
  listExistingDjNames: async (userId) => {
    const { data, error } = await admin
      .from("djs")
      .select("name")
      .or(`owner_id.is.null,is_public.eq.true,owner_id.eq.${userId}`)
      .limit(500);
    if (error) throw error;
    return (data ?? []).flatMap((row) =>
      typeof row.name === "string" ? [row.name] : [],
    );
  },
  loadDjContext: async (djId) => {
    const { data: dj, error: djError } = await admin
      .from("djs")
      .select(
        "owner_id,name,identity_concept,genre_specialties,mood_tags,character,personality_traits",
      )
      .eq("id", djId)
      .maybeSingle();
    if (djError) throw djError;
    if (!dj) return null;

    const { data: config, error: configError } = await admin
      .from("dj_generation_configs")
      .select("is_instrumental,max_duration")
      .eq("dj_id", djId)
      .maybeSingle();
    if (configError) throw configError;
    if (!config) return null;

    const personality =
      dj.personality_traits &&
      typeof dj.personality_traits === "object" &&
      !Array.isArray(dj.personality_traits)
        ? (dj.personality_traits as Record<string, unknown>)
        : {};
    const energy = personality.energy;
    if (!Number.isInteger(energy)) throw new Error("invalid_dj_energy");

    return {
      ownerId: dj.owner_id ?? "",
      djName: dj.name,
      genres: dj.genre_specialties ?? [],
      moods: dj.mood_tags ?? [],
      energy: Number(energy),
      isInstrumental: config.is_instrumental,
      vibe: dj.character,
      identityConcept: dj.identity_concept,
      durationSeconds: Math.min(Number(config.max_duration) || 150, 180),
    };
  },
  loadRecentMemory: async (djId) => {
    const [{ data: jobs, error: jobsError }, { data: tracks, error: tracksError }] =
      await Promise.all([
        admin
          .from("generation_jobs")
          .select("generation_brief")
          .eq("dj_id", djId)
          .not("generation_brief", "is", null)
          .order("created_at", { ascending: false })
          .limit(10),
        admin
          .from("tracks")
          .select("title")
          .eq("dj_id", djId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
    if (jobsError) throw jobsError;
    if (tracksError) throw tracksError;
    return extractRecentCreativeMemory(
      (jobs ?? []).map((row) => row.generation_brief),
      (tracks ?? []).map((row) => row.title),
    );
  },
  generateText: (model, body) =>
    replicateTextPrediction(model.endpoint, body, {
      pollIntervalMs: 1_500,
      maxPolls: 40,
    }),
  recordUsage: logCreativeUsageEvent,
};

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

  const result = await handleCreativeDraftRequest(body, user.id, dependencies);
  return json(result.body, result.status);
});
