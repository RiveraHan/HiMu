/**
 * The user requests a mix from a DJ; the function creates a generation_job and
 * responds { jobId } immediately. Generation runs in the background with
 * EdgeRuntime.waitUntil (Replicate → R2 → insert track). The client polls the job.
 *
 * v2: daily quota, DJ authorization (system or own), optional user lyrics
 * (own vocal DJs only), and R2 cleanup when a generation fails mid-way.
 */

import { streamUrl } from "../_shared/audius.ts";
import { generateCoverImage } from "../_shared/cover.ts";
import { json } from "../_shared/http.ts";
import { countDailyGenerations, DAILY_GENERATION_LIMIT } from "../_shared/quota.ts";
import { r2Delete, r2Put } from "../_shared/r2.ts";
import { replicateRun, replicateText } from "../_shared/replicate.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";
import { pickAudiusDrop } from "./audius-drop.ts";
import {
  handleGenerateMixRequest,
  runGeneration,
} from "./generation-orchestration.ts";

// Cover generation falls back to the DJ avatar so a model failure never
// removes the generated track's artwork.
async function generateCover(
  jobId: string,
  dj: any,
  instrumental: boolean,
): Promise<string | null> {
  try {
    return await generateCoverImage(`covers/generated/${jobId}.jpg`, {
      genre: dj.genre_specialties?.[0] ?? "",
      moods: dj.mood_tags ?? [],
      instrumental,
    });
  } catch (_error) {
    return dj.avatar_url ?? null;
  }
}

const TOP_GENRE_DAYS = 14;

// Catalog-only clauses: the user's taste nudges the mix; the DJ's base_prompt
// still leads. No user-provided free text enters the prompt here.
async function buildSeasoning(
  userId: string,
  dj: any,
  localHour: unknown,
): Promise<string[]> {
  const clauses: string[] = [];

  try {
    const since = new Date(Date.now() - TOP_GENRE_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [{ data: prefs }, { data: stats }] = await Promise.all([
      admin
        .from("music_preferences")
        .select("genres")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("listening_stats")
        .select("top_genre")
        .eq("user_id", userId)
        .gte("date", since)
        .not("top_genre", "is", null),
    ]);

    const counts = new Map<string, number>();
    for (const row of stats ?? []) {
      counts.set(row.top_genre, (counts.get(row.top_genre) ?? 0) + 1);
    }
    const topGenre =
      [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const djGenres: string[] = dj?.genre_specialties ?? [];
    const candidates = [topGenre, ...(prefs?.genres ?? [])].filter(
      (genre): genre is string => typeof genre === "string",
    );
    const emphasis = candidates.find((genre) => djGenres.includes(genre));
    if (emphasis) clauses.push(`emphasis on ${emphasis.toLowerCase()}`);
  } catch (error) {
    console.error("[generate-mix] seasoning skipped:", error);
  }

  const hour =
    typeof localHour === "number" &&
      Number.isInteger(localHour) &&
      localHour >= 0 &&
      localHour <= 23
      ? localHour
      : new Date().getUTCHours();

  clauses.push(
    hour >= 5 && hour <= 11
      ? "fresh morning feel"
      : hour >= 12 && hour <= 17
        ? "steady daytime flow"
        : hour >= 18 && hour <= 22
          ? "evening warmth"
          : "late night atmosphere",
  );
  return clauses;
}

const generationDependencies = {
  updateJob: async (jobId: string, patch: Record<string, unknown>) => {
    await admin
      .from("generation_jobs")
      .update(patch)
      .eq("id", jobId);
  },
  findAudiusTrack: async (externalId: string) => {
    const { data } = await admin
      .from("tracks")
      .select("id")
      .eq("source", "audius")
      .eq("external_id", externalId)
      .maybeSingle();
    return data;
  },
  insertAudiusTrack: async (values: Record<string, unknown>) => {
    const { data, error } = await admin
      .from("tracks")
      .insert(values)
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("materialize failed");
    return data;
  },
  insertGeneratedTrack: async (values: Record<string, unknown>) => {
    const { data, error } = await admin
      .from("tracks")
      .insert(values)
      .select()
      .single();
    if (error || !data) throw error ?? new Error("could not insert track");
    return data;
  },
  pickAudiusDrop,
  replicateRun,
  replicateText,
  fetchMedia: (url: string) => fetch(url),
  r2Put,
  r2Delete,
  generateCover,
  streamUrl,
  logModel: (event: { role: string; language: string }) => {
    console.log("[generate-mix] model", event);
  },
  logError: (event: { stage: string }) => {
    console.error("[generate-mix] generation", event);
  },
  now: () => new Date().toISOString(),
};

serveAuthed(async (req, user) => {
  const body = await req.json();
  const response = await handleGenerateMixRequest(body, user.id, {
    getDjConfig: async (djId) => {
      const { data } = await admin
        .from("dj_generation_configs")
        .select(
          "dj_id, base_prompt, is_instrumental, default_lyrics, max_duration, djs(name, slug, character, voice_style, genre_specialties, mood_tags, avatar_url, owner_id)",
        )
        .eq("dj_id", djId)
        .single();
      return data;
    },
    buildSeasoning,
    findDailyJob: async (userId, dropDate) => {
      const { data } = await admin
        .from("generation_jobs")
        .select("id, status")
        .eq("user_id", userId)
        .eq("drop_date", dropDate)
        .maybeSingle();
      return data;
    },
    requeueDailyJob: async (jobId, updatedAt) => {
      await admin
        .from("generation_jobs")
        .update({
          status: "queued",
          error: null,
          updated_at: updatedAt,
        })
        .eq("id", jobId);
    },
    createDailyJob: async ({ userId, djId, dropDate }) => {
      const { data, error } = await admin
        .from("generation_jobs")
        .insert({
          user_id: userId,
          dj_id: djId,
          status: "queued",
          drop_date: dropDate,
        })
        .select()
        .single();
      return { job: data, error };
    },
    countDailyGenerations,
    dailyGenerationLimit: DAILY_GENERATION_LIMIT,
    createManualJob: async ({ userId, djId, lyrics }) => {
      const { data, error } = await admin
        .from("generation_jobs")
        .insert({
          user_id: userId,
          dj_id: djId,
          prompt: lyrics,
          status: "queued",
        })
        .select()
        .single();
      return { job: data, error };
    },
    runGeneration: (input) => runGeneration(input, generationDependencies),
    waitUntil: (promise) => EdgeRuntime.waitUntil(promise),
    now: () => new Date().toISOString(),
  });

  return json(response.body, response.status);
});
