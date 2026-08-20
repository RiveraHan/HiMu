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
import { r2Delete, r2Put } from "../_shared/r2.ts";
import { replicateRun, replicateText } from "../_shared/replicate.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";
import { pickAudiusDrop } from "./audius-drop.ts";
import {
  handleGenerateMixRequest,
  mapFinalizedGeneratedMix,
  mapManualJobReservation,
  mapUpdatedRow,
  runGeneration,
} from "./generation-orchestration.ts";

// Cover generation falls back to the DJ avatar so a model failure never
// removes the generated track's artwork.
async function generateCover(
  objectKey: string,
  dj: any,
  instrumental: boolean,
): Promise<string | null> {
  try {
    return await generateCoverImage(objectKey, {
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
  updateJob: async (
    jobId: string,
    attemptStartedAt: string,
    patch: Record<string, unknown>,
  ) => {
    const { data, error } = await admin
      .from("generation_jobs")
      .update(patch)
      .eq("id", jobId)
      .eq("status", "generating")
      .eq("updated_at", attemptStartedAt)
      .select("id")
      .maybeSingle();
    return mapUpdatedRow(data, error);
  },
  markJobGenerating: async (
    jobId: string,
    queuedAt: string,
    startedAt: string,
  ) => {
    const { data, error } = await admin
      .from("generation_jobs")
      .update({ status: "generating", error: null, updated_at: startedAt })
      .eq("id", jobId)
      .eq("status", "queued")
      .eq("updated_at", queuedAt)
      .select("id")
      .maybeSingle();
    return mapUpdatedRow(data, error);
  },
  finalizeGeneratedMix: async (input: {
    jobId: string;
    trackId: string;
    title: string;
    artist: string;
    audioUrl: string;
    albumArtUrl: string | null;
    genre: string | null;
    moodTags: string[] | null;
    duration: number;
    djId: string;
    caption: string | null;
    captionAudioUrl: string | null;
    attemptStartedAt: string;
    finishedAt: string;
  }) => {
    const { data, error } = await admin
      .rpc("finalize_generated_mix", {
        p_job_id: input.jobId,
        p_track_id: input.trackId,
        p_title: input.title,
        p_artist: input.artist,
        p_audio_url: input.audioUrl,
        p_album_art_url: input.albumArtUrl,
        p_genre: input.genre,
        p_mood_tags: input.moodTags,
        p_duration: input.duration,
        p_dj_id: input.djId,
        p_caption: input.caption,
        p_caption_audio_url: input.captionAudioUrl,
        p_started_at: input.attemptStartedAt,
        p_finished_at: input.finishedAt,
      })
      .single();
    return mapFinalizedGeneratedMix(
      data,
      error,
      input.jobId,
      input.trackId,
    );
  },
  failJobIfActive: async (
    jobId: string,
    errorMessage: string,
    failedAt: string,
    fence: { queuedAt?: string; generatingAt: string },
  ) => {
    const expected = fence.queuedAt
      ? [
        { status: "queued", updatedAt: fence.queuedAt },
        { status: "generating", updatedAt: fence.generatingAt },
      ]
      : [{ status: "generating", updatedAt: fence.generatingAt }];

    for (const state of expected) {
      const { data, error } = await admin
        .from("generation_jobs")
        .update({
          status: "failed",
          error: errorMessage,
          updated_at: failedAt,
        })
        .eq("id", jobId)
        .eq("status", state.status)
        .eq("updated_at", state.updatedAt)
        .select("id")
        .maybeSingle();
      if (mapUpdatedRow(data, error)) return true;
    }
    return false;
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
  randomId: () => crypto.randomUUID(),
};

serveAuthed(async (req, user) => {
  const body = await req.json();
  const response = await handleGenerateMixRequest(body, user.id, {
    getDjConfig: async (djId) => {
      const { data } = await admin
        .from("dj_generation_configs")
        .select(
          "dj_id, base_prompt, is_instrumental, default_lyrics, max_duration, djs(name, slug, character, identity_concept, personality_traits, voice_style, genre_specialties, mood_tags, avatar_url, owner_id)",
        )
        .eq("dj_id", djId)
        .single();
      return data;
    },
    buildSeasoning,
    findDailyJob: async (userId, dropDate) => {
      const { data, error } = await admin
        .from("generation_jobs")
        .select("id, status, dj_id, updated_at, is_public")
        .eq("user_id", userId)
        .eq("drop_date", dropDate)
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
          id: data.id,
          status: data.status,
          djId: data.dj_id,
          updatedAt: data.updated_at,
          isPublic: data.is_public,
        }
        : null;
    },
    requeueDailyJob: async (
      jobId,
      observedStatus,
      observedUpdatedAt,
      requeuedAt,
    ) => {
      const { data, error } = await admin
        .from("generation_jobs")
        .update({
          status: "queued",
          error: null,
          updated_at: requeuedAt,
        })
        .eq("id", jobId)
        .eq("status", observedStatus)
        .eq("updated_at", observedUpdatedAt)
        .select("id")
        .maybeSingle();
      return mapUpdatedRow(data, error);
    },
    createDailyJob: async ({ userId, djId, dropDate }) => {
      const { data, error } = await admin
        .from("generation_jobs")
        .insert({
          user_id: userId,
          dj_id: djId,
          status: "queued",
          drop_date: dropDate,
          is_public: false,
        })
        .select("id, status, dj_id, updated_at, is_public")
        .single();
      return {
        job: data
          ? {
            id: data.id,
            status: data.status,
            djId: data.dj_id,
            updatedAt: data.updated_at,
            isPublic: data.is_public,
          }
          : null,
        error,
      };
    },
    findActiveManualJob: async (userId, djId) => {
      const { data, error } = await admin
        .from("generation_jobs")
        .select("id, status, updated_at, is_public, generation_brief, source_track_id")
        .eq("user_id", userId)
        .eq("dj_id", djId)
        .is("drop_date", null)
        .in("status", ["queued", "generating"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
          id: data.id,
          status: data.status,
          updatedAt: data.updated_at,
          isPublic: data.is_public,
          brief: data.generation_brief,
          sourceTrackId: data.source_track_id,
        }
        : null;
    },
    failStaleManualJob: async (jobId, observedUpdatedAt, failedAt) => {
      const { data, error } = await admin
        .from("generation_jobs")
        .update({
          status: "failed",
          error: "generation_stalled",
          updated_at: failedAt,
        })
        .eq("id", jobId)
        .eq("updated_at", observedUpdatedAt)
        .in("status", ["queued", "generating"])
        .select("id")
        .maybeSingle();
      return mapUpdatedRow(data, error);
    },
    getSourceTrack: async (sourceTrackId) => {
      const { data, error } = await admin
        .from("tracks")
        .select("id,owner_id,dj_id")
        .eq("id", sourceTrackId)
        .maybeSingle();
      if (error) throw error;
      return data
        ? { id: data.id, ownerId: data.owner_id, djId: data.dj_id }
        : null;
    },
    requeueLegacyManualJob: async ({ userId, djId, jobId }) => {
      const { data, error } = await admin
        .rpc("retry_legacy_manual_generation_job", {
          p_user_id: userId,
          p_dj_id: djId,
          p_job_id: jobId,
        })
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      if (data.outcome === "quota" || data.outcome === "unavailable") {
        return {
          outcome: data.outcome,
          jobId: null,
          dailyLimit: data.daily_limit,
        };
      }
      return {
        outcome: data.outcome,
        jobId: data.job_id,
        dailyLimit: data.daily_limit,
        queuedAt: data.queued_at,
        isPublic: data.is_public,
        lyrics: data.prompt,
      };
    },
    reserveManualJob: async ({
      userId,
      djId,
      brief,
      isPublic,
      sourceTrackId,
    }) => {
      const { data, error } = await admin.rpc(
        "reserve_manual_generation_job",
        {
          p_user_id: userId,
          p_dj_id: djId,
          p_generation_brief: brief,
          p_is_public: isPublic,
          p_source_track_id: sourceTrackId,
        },
      );
      return mapManualJobReservation(data, error);
    },
    runGeneration: (input) => runGeneration(input, generationDependencies),
    waitUntil: (promise) => EdgeRuntime.waitUntil(promise),
    now: () => new Date().toISOString(),
  });

  return json(response.body, response.status);
});
