/**
 * Regenerate the cover of a track that belongs to one of the user's DJs.
 * Reservations and finalization are atomic in Postgres; provider and R2 work
 * remains outside the transaction and is cleaned up only with proven ownership.
 */
import { generateCoverImage } from "../_shared/cover.ts";
import { json } from "../_shared/http.ts";
import { keyFromPublicUrl, r2Delete } from "../_shared/r2.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";
import {
  handleRegenerateCoverRequest,
  mapCoverFinalization,
  mapCoverReservation,
  mapCoverReservationFailure,
} from "./cover-orchestration.ts";

serveAuthed(async (req, user) => {
  const body = await req.json();
  const response = await handleRegenerateCoverRequest(body, user.id, {
    getTrack: async (trackId) => {
      const { data, error } = await admin
        .from("tracks")
        .select("id, genre, mood_tags, dj_id, source, djs(owner_id)")
        .eq("id", trackId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        genre: data.genre,
        moodTags: data.mood_tags,
        djId: data.dj_id,
        source: data.source,
        ownerId: (data.djs as any)?.owner_id ?? null,
      };
    },
    getDjConfig: async (djId) => {
      const { data, error } = await admin
        .from("dj_generation_configs")
        .select("is_instrumental")
        .eq("dj_id", djId)
        .maybeSingle();
      if (error) throw error;
      return data ? { isInstrumental: data.is_instrumental } : null;
    },
    reserveCover: async ({ userId, trackId }) => {
      const { data, error } = await admin.rpc("reserve_cover_generation", {
        p_user_id: userId,
        p_track_id: trackId,
      });
      return mapCoverReservation(data, error);
    },
    generateCover: generateCoverImage,
    finalizeCover: async (input) => {
      const { data, error } = await admin.rpc(
        "finalize_cover_regeneration",
        {
          p_reservation_id: input.reservationId,
          p_user_id: input.userId,
          p_track_id: input.trackId,
          p_album_art_url: input.albumArtUrl,
          p_finished_at: input.finishedAt,
        },
      );
      return mapCoverFinalization(data, error);
    },
    failReservation: async (input) => {
      const { data, error } = await admin.rpc(
        "fail_cover_generation_reservation",
        {
          p_reservation_id: input.reservationId,
          p_user_id: input.userId,
          p_failed_at: input.failedAt,
        },
      );
      return mapCoverReservationFailure(data, error);
    },
    keyFromPublicUrl,
    r2Delete,
    now: () => new Date().toISOString(),
    logError: (event) => {
      console.error("[regenerate-cover] orchestration", event);
    },
  });

  return json(response.body, response.status);
});
