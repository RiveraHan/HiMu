import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assertCurrentMutationUser,
  authMutationKey,
  captureAuthScope,
  invokeWithAuthScope,
  isCurrentMutationUser,
  setAuthScopeHeader,
} from "@/src/api/auth-scope";
import { queryKeys } from "@/src/api/queries";
import { supabase } from "@/src/api/supabase";
import { useCurrentUser } from "@/src/hooks/use-auth";
import type {
  OwnerTrackMoment,
  TrackMomentFeedback,
  TrackMomentFeedbackPatch,
  TrackMomentVisibility,
} from "@/src/moment/moment-types";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const feedbackTails = new Map<string, Promise<void>>();

export type SetTrackMomentVisibilityInput = Readonly<{
  trackId: string;
  visibility: TrackMomentVisibility;
}>;

function validString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 2_048 &&
    value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
}

function validHttpsUrl(value: unknown): value is string {
  if (!validString(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function parseFeedback(value: unknown): TrackMomentFeedback | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).some((key) => key !== "surprised" && key !== "would_share") ||
    (row.surprised !== null && typeof row.surprised !== "boolean") ||
    (row.would_share !== null && typeof row.would_share !== "boolean")
  ) return null;
  return Object.freeze({
    surprised: row.surprised as boolean | null,
    wouldShare: row.would_share as boolean | null,
  });
}

function parseVisibilityResult(
  value: unknown,
  expected: SetTrackMomentVisibilityInput,
): OwnerTrackMoment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).length !== 4 ||
    !Object.hasOwn(row, "trackId") ||
    !Object.hasOwn(row, "visibility") ||
    !Object.hasOwn(row, "audioUrl") ||
    !Object.hasOwn(row, "albumArtUrl") ||
    row.trackId !== expected.trackId ||
    row.visibility !== expected.visibility ||
    !validString(row.audioUrl) ||
    (row.visibility === "public" && !validHttpsUrl(row.audioUrl)) ||
    (row.albumArtUrl !== null && !validHttpsUrl(row.albumArtUrl))
  ) return null;
  return Object.freeze({
    trackId: row.trackId,
    visibility: row.visibility as TrackMomentVisibility,
    audioUrl: row.audioUrl,
    albumArtUrl: row.albumArtUrl as string | null,
  });
}

function assertFeedbackPatch(
  patch: TrackMomentFeedbackPatch,
): "surprised" | "wouldShare" {
  if (!patch || typeof patch !== "object" || !UUID.test(patch.trackId)) {
    throw new Error("invalid_track_moment_feedback");
  }
  const keys = Object.keys(patch).sort();
  const isSurprisedPatch = keys.length === 2 &&
    keys[0] === "surprised" && keys[1] === "trackId";
  const isWouldSharePatch = keys.length === 2 &&
    keys[0] === "trackId" && keys[1] === "wouldShare";
  if (!isSurprisedPatch && !isWouldSharePatch) {
    throw new Error("invalid_track_moment_feedback");
  }
  if (Object.hasOwn(patch, "surprised") && typeof patch.surprised === "boolean") {
    return "surprised";
  }
  if (Object.hasOwn(patch, "wouldShare") && typeof patch.wouldShare === "boolean") {
    return "wouldShare";
  }
  throw new Error("invalid_track_moment_feedback");
}

function enqueueFeedback<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = feedbackTails.get(key) ?? Promise.resolve();
  const result = previous.then(operation, operation);
  const tail = result.then(() => undefined, () => undefined);
  feedbackTails.set(key, tail);
  return result.finally(() => {
    if (feedbackTails.get(key) === tail) feedbackTails.delete(key);
  });
}

export function useOwnerTrackMoment(trackId: string | undefined) {
  const user = useCurrentUser();
  const userId = user?.id ?? "";
  const id = typeof trackId === "string" ? trackId : "";

  return useQuery({
    queryKey: queryKeys.trackMoments.owner(user?.id ?? null, id),
    enabled: !!user && UUID.test(id),
    queryFn: async (): Promise<OwnerTrackMoment | null> => {
      const scope = captureAuthScope(userId);
      const trackQuery = setAuthScopeHeader(
        supabase
          .from("tracks")
          .select("id,owner_id,is_public,is_ai_generated,audio_url,album_art_url"),
        scope,
      );
      const { data: track, error: trackError } = await trackQuery
        .eq("id", id)
        .eq("owner_id", scope.userId)
        .maybeSingle();
      assertCurrentMutationUser(scope.userId);
      if (trackError) throw trackError;
      if (
        !track || track.id !== id || track.owner_id !== scope.userId ||
        track.is_ai_generated !== true || !validString(track.audio_url) ||
        (track.album_art_url !== null && !validHttpsUrl(track.album_art_url))
      ) return null;

      const readyQuery = setAuthScopeHeader(
        supabase
          .from("generation_jobs")
          .select("id")
          .eq("track_id", id)
          .eq("user_id", scope.userId)
          .eq("status", "ready")
          .limit(1),
        scope,
      );
      const { data: ready, error: readyError } = await readyQuery.maybeSingle();
      assertCurrentMutationUser(scope.userId);
      if (readyError) throw readyError;
      if (!ready) return null;

      return Object.freeze({
        trackId: id,
        visibility: track.is_public ? "public" : "private",
        audioUrl: track.audio_url,
        albumArtUrl: track.album_art_url,
      });
    },
  });
}

export function useTrackMomentFeedback(trackId: string | undefined) {
  const user = useCurrentUser();
  const userId = user?.id ?? "";
  const id = typeof trackId === "string" ? trackId : "";

  return useQuery({
    queryKey: queryKeys.trackMoments.feedback(user?.id ?? null, id),
    enabled: !!user && UUID.test(id),
    queryFn: async (): Promise<TrackMomentFeedback> => {
      const scope = captureAuthScope(userId);
      const query = setAuthScopeHeader(
        supabase
          .from("track_experience_feedback")
          .select("surprised,would_share"),
        scope,
      );
      const { data, error } = await query
        .eq("user_id", scope.userId)
        .eq("track_id", id)
        .maybeSingle();
      assertCurrentMutationUser(scope.userId);
      if (error) throw error;
      if (data === null) return Object.freeze({ surprised: null, wouldShare: null });
      const parsed = parseFeedback(data);
      if (!parsed) throw new Error("invalid_track_moment_feedback_response");
      return parsed;
    },
  });
}

export function useUpdateTrackMomentFeedback() {
  const userId = useCurrentUser()?.id ?? "";
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: authMutationKey("update-track-moment-feedback", userId),
    mutationFn: (patch: TrackMomentFeedbackPatch) => {
      const field = assertFeedbackPatch(patch);
      return enqueueFeedback(`${userId}:${patch.trackId}`, async () => {
        const scope = captureAuthScope(userId);
        const answer = field === "surprised"
          ? { surprised: patch.surprised }
          : { would_share: patch.wouldShare };
        const write = setAuthScopeHeader(
          supabase.from("track_experience_feedback").upsert({
            user_id: scope.userId,
            track_id: patch.trackId,
            ...answer,
          }, { onConflict: "user_id,track_id" }),
          scope,
        );
        const { data: written, error: writeError } = await write
          .select("surprised,would_share")
          .maybeSingle();
        assertCurrentMutationUser(scope.userId);
        if (writeError) throw writeError;
        const authoritative = parseFeedback(written);
        if (!authoritative) throw new Error("invalid_track_moment_feedback_response");
        return authoritative;
      });
    },
    onSuccess: (feedback, patch) => {
      if (!isCurrentMutationUser(userId)) return;
      queryClient.setQueryData(
        queryKeys.trackMoments.feedback(userId, patch.trackId),
        feedback,
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.trackMoments.feedback(userId, patch.trackId),
      });
    },
  });
}

export function useSetTrackMomentVisibility() {
  const userId = useCurrentUser()?.id ?? "";
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: authMutationKey("set-track-moment-visibility", userId),
    mutationFn: async (input: SetTrackMomentVisibilityInput) => {
      if (
        !input || typeof input !== "object" ||
        Object.keys(input).length !== 2 || !UUID.test(input.trackId) ||
        (input.visibility !== "private" && input.visibility !== "public")
      ) throw new Error("invalid_track_moment_visibility");
      const scope = captureAuthScope(userId);
      const { data, error } = await invokeWithAuthScope<unknown>(
        supabase.functions,
        scope,
        "track-moment",
        { body: { action: "set_visibility", ...input } },
      );
      assertCurrentMutationUser(scope.userId);
      if (error) throw new Error("track_moment_visibility_failed");
      const parsed = parseVisibilityResult(data, input);
      if (!parsed) throw new Error("invalid_track_moment_visibility_response");
      return parsed;
    },
    onSuccess: (moment) => {
      if (!isCurrentMutationUser(userId)) return;
      queryClient.setQueryData(
        queryKeys.trackMoments.owner(userId, moment.trackId),
        moment,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.tracks.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.publicTracks.detail(moment.trackId),
      });
    },
  });
}

export function useTrackMoment(trackId: string | undefined) {
  return {
    owner: useOwnerTrackMoment(trackId),
    feedback: useTrackMomentFeedback(trackId),
    setFeedback: useUpdateTrackMomentFeedback(),
    setVisibility: useSetTrackMomentVisibility(),
  };
}
