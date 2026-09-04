import {
  r2CopyPrivateGeneratedTrack,
  r2DeleteOwnedTrackMomentCleanup,
  r2DeleteValidatedPublicTrack,
  R2_PUBLIC_BASE,
  r2VerifyPublicGeneratedTrack,
} from "../_shared/r2.ts";
import { admin } from "../_shared/supabase.ts";
import {
  handleTrackMomentRequest,
  type PublishClaim,
  type TrackMomentDependencies,
  type TrackMomentResult,
  type UnpublishOutcome,
} from "./handler.ts";

type RpcError = { message?: string | null };

function firstRecord(value: unknown): Record<string, unknown> | null {
  const item = Array.isArray(value) ? value[0] : value;
  return item && typeof item === "object" && !Array.isArray(item)
    ? item as Record<string, unknown>
    : null;
}

function rpcFailure(error: RpcError | null): void {
  if (error) throw new Error("track_moment_transition_failed");
}

export const trackMomentDependencies: TrackMomentDependencies = {
  publicBase: R2_PUBLIC_BASE,
  createOperationToken: () => crypto.randomUUID(),
  loadTrack: async (trackId) => {
    const { data, error } = await admin
      .from("tracks")
      .select("id,owner_id,is_public,is_ai_generated,audio_url,album_art_url")
      .eq("id", trackId)
      .maybeSingle();
    if (error) throw new Error("track_state_unavailable");
    if (!data) return null;
    const ready = await admin
      .from("generation_jobs")
      .select("id")
      .eq("track_id", trackId)
      .eq("user_id", data.owner_id ?? "")
      .eq("status", "ready")
      .limit(1);
    if (ready.error) throw new Error("track_state_unavailable");
    return {
      id: data.id,
      ownerId: data.owner_id,
      isPublic: data.is_public,
      isAiGenerated: data.is_ai_generated,
      isReady: (ready.data?.length ?? 0) > 0,
      audioRef: data.audio_url,
      albumArtRef: data.album_art_url,
    };
  },
  claimPublish: async (input) => {
    const { data, error } = await admin.rpc("claim_track_moment_publish", {
      p_track_id: input.trackId,
      p_user_id: input.userId,
      p_operation_token: input.operationToken,
      p_private_audio_ref: input.privateAudioRef,
    });
    rpcFailure(error);
    const outcome = firstRecord(data)?.outcome;
    if (typeof outcome !== "string") throw new Error("invalid_claim_response");
    return { outcome } as PublishClaim;
  },
  copyPrivateTrack: r2CopyPrivateGeneratedTrack,
  verifyPublicTrack: r2VerifyPublicGeneratedTrack,
  finalizePublish: async (input) => {
    const { data, error } = await admin.rpc("finalize_track_moment_publish", {
      p_track_id: input.trackId,
      p_user_id: input.userId,
      p_operation_token: input.operationToken,
      p_public_audio_url: input.publicAudioUrl,
      p_public_object_key: input.publicObjectKey,
    });
    rpcFailure(error);
    return data === true;
  },
  abortPublish: async (input) => {
    const { data, error } = await admin.rpc("abort_track_moment_publish", {
      p_track_id: input.trackId,
      p_user_id: input.userId,
      p_operation_token: input.operationToken,
    });
    rpcFailure(error);
    return data === true;
  },
  enqueueCleanup: async (input) => {
    const { data, error } = await admin.rpc("queue_track_moment_cleanup", {
      p_track_id: input.trackId,
      p_user_id: input.userId,
      p_operation_token: input.operationToken,
      p_public_object_key: input.publicObjectKey,
    });
    rpcFailure(error);
    return data === true;
  },
  listPendingCleanup: async (input) => {
    const { data, error } = await admin.rpc("list_track_moment_cleanup", {
      p_track_id: input.trackId,
      p_user_id: input.userId,
    });
    rpcFailure(error);
    if (!Array.isArray(data)) throw new Error("invalid_cleanup_list_response");
    return data.map((row) => {
      const record = firstRecord(row);
      if (
        !record || typeof record.operation_token !== "string" ||
        typeof record.public_object_key !== "string"
      ) {
        throw new Error("invalid_cleanup_list_response");
      }
      return {
        operationToken: record.operation_token,
        publicObjectKey: record.public_object_key,
      };
    });
  },
  acknowledgeCleanup: async (input) => {
    const { data, error } = await admin.rpc("acknowledge_track_moment_cleanup", {
      p_track_id: input.trackId,
      p_user_id: input.userId,
      p_operation_token: input.operationToken,
      p_public_object_key: input.publicObjectKey,
    });
    rpcFailure(error);
    return data === true;
  },
  deleteOwnedCleanup: r2DeleteOwnedTrackMomentCleanup,
  unpublish: async (input) => {
    const { data, error } = await admin.rpc("unpublish_track_moment", {
      p_track_id: input.trackId,
      p_user_id: input.userId,
    });
    rpcFailure(error);
    const row = firstRecord(data);
    if (!row || typeof row.outcome !== "string") {
      throw new Error("invalid_unpublish_response");
    }
    return {
      outcome: row.outcome,
      privateAudioRef: row.private_audio_ref,
      publicAudioUrl: row.public_audio_url,
      publicObjectKey: row.public_object_key,
    } as UnpublishOutcome;
  },
  deleteValidatedPublic: r2DeleteValidatedPublicTrack,
};

export async function handleTrackMomentHttpRequest(
  req: Pick<Request, "method" | "json">,
  userId: string,
  deps: TrackMomentDependencies = trackMomentDependencies,
): Promise<TrackMomentResult> {
  if (req.method !== "POST") {
    return { status: 405, body: { error: "method_not_allowed", code: "method_not_allowed" } };
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { status: 400, body: { error: "invalid_input", code: "invalid_input" } };
  }
  return handleTrackMomentRequest(body, userId, deps);
}
