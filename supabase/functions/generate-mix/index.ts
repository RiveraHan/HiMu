/**
 * The user requests a mix from a DJ; the function creates a generation_job and
 * responds { jobId } immediately. Generation runs in the background with
 * EdgeRuntime.waitUntil (Replicate → R2 → insert track). The client polls the job.
 *
 * v2: daily quota, DJ authorization (system or own), optional user lyrics
 * (own vocal DJs only), and R2 cleanup when a generation fails mid-way.
 */

import { streamUrl } from "../_shared/audius.ts";
import { generateCoverImage, type CoverContext } from "../_shared/cover.ts";
import { resolveCreativeModel } from "../_shared/creative-models.ts";
import { runObservedCreativePrediction } from "../_shared/creative-telemetry.ts";
import { json } from "../_shared/http.ts";
import { r2Delete, r2Put } from "../_shared/r2.ts";
import {
  replicateMediaPrediction,
  replicateTextPrediction,
} from "../_shared/replicate.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";
import { pickAudiusDrop } from "./audius-drop.ts";
import { buildGenerationSeasoning } from "./generation-seasoning.ts";
import {
  handleGenerateMixRequest,
  mapDailyJobReservation,
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
  context?: Pick<
    CoverContext,
    "seed" | "visualPlan" | "language" | "briefVersion"
  >,
): Promise<string | null> {
  try {
    return await generateCoverImage(objectKey, {
      genre: dj.genre_specialties?.[0] ?? "",
      moods: dj.mood_tags ?? [],
      instrumental,
      seed: context?.seed,
      visualPlan: context?.visualPlan ?? null,
      language: context?.language,
      briefVersion: context?.briefVersion,
    });
  } catch (_error) {
    return dj.avatar_url ?? null;
  }
}

async function buildSeasoning(
  userId: string,
  dj: any,
  localHour: unknown,
): Promise<string[]> {
  return await buildGenerationSeasoning(
    {
      userId,
      djGenres: Array.isArray(dj?.genre_specialties)
        ? dj.genre_specialties
        : [],
      localHour,
    },
    {
      loadPreferences: async (lookupUserId) => {
        const { data, error } = await admin
          .from("music_preferences")
          .select("genres,atmosphere")
          .eq("user_id", lookupUserId)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      loadTopGenres: async (lookupUserId, since) => {
        const { data, error } = await admin
          .from("listening_stats")
          .select("top_genre")
          .eq("user_id", lookupUserId)
          .gte("date", since)
          .not("top_genre", "is", null);
        if (error) throw error;
        return (data ?? []).map((row) => row.top_genre);
      },
      now: () => new Date(),
    },
  );
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
  replicateRun: async (endpoint, body, observation) => {
    const model = resolveCreativeModel(observation.role);
    if (model.endpoint !== endpoint) throw new Error("creative_model_endpoint_mismatch");
    return await runObservedCreativePrediction(
      { model, ...observation },
      () =>
        replicateMediaPrediction(endpoint, body, {
          pollIntervalMs: 3_000,
          maxPolls: 80,
        }),
    );
  },
  replicateText: async (endpoint, body, observation) => {
    const model = resolveCreativeModel(observation.role);
    if (model.endpoint !== endpoint) throw new Error("creative_model_endpoint_mismatch");
    return await runObservedCreativePrediction(
      { model, ...observation },
      () =>
        replicateTextPrediction(endpoint, body, {
          pollIntervalMs: 1_500,
          maxPolls: 40,
        }),
    );
  },
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
    reserveDailyJob: async ({ userId, djId, dropDate }) => {
      const { data, error } = await admin
        .rpc("reserve_daily_generation_job", {
          p_user_id: userId,
          p_dj_id: djId,
          p_drop_date: dropDate,
        })
        .maybeSingle();
      return mapDailyJobReservation(data, error);
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
