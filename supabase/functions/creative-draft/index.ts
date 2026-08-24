import { json } from "../_shared/http.ts";
import { mapProviderReservation } from "../_shared/provider-usage.ts";
import { replicateText } from "../_shared/replicate.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";
import { LLAMA_ENDPOINT } from "../generate-mix/generation-models.ts";
import {
  handleCreativeDraftRequest,
  type CreativeDraftDependencies,
} from "./handler.ts";

const dependencies: CreativeDraftDependencies = {
  endpoint: LLAMA_ENDPOINT,
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
      .select("is_instrumental")
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
    };
  },
  generateText: replicateText,
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
