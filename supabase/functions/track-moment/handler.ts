import {
  parseGeneratedPublicKey,
  parseOwnedTrackPromotion,
  parsePrivateMediaReference,
  safePublicHttpsUrl,
  trackMomentPublicKey,
} from "../_shared/media-reference.ts";
import type { TrackPromotionObject } from "../_shared/r2.ts";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TrackMomentRecord = Readonly<{
  id: string;
  ownerId: string | null;
  isPublic: boolean;
  isAiGenerated: boolean;
  isReady: boolean;
  audioRef: string | null;
  albumArtRef: string | null;
}>;

export type PublishClaim = Readonly<{
  outcome:
    | "claimed"
    | "busy"
    | "already_public"
    | "not_found"
    | "not_owner"
    | "ineligible"
    | "invalid_media"
    | "invalid_state";
}>;

export type TrackMomentCleanupTarget = Readonly<{
  operationToken: string;
  publicObjectKey: string;
}>;

export type UnpublishOutcome = Readonly<{
  outcome:
    | "unpublished"
    | "already_private"
    | "legacy_unsafe"
    | "not_found"
    | "not_owner"
    | "ineligible"
    | "invalid_media"
    | "conflict";
  privateAudioRef?: string | null;
  publicAudioUrl?: string | null;
  publicObjectKey?: string | null;
}>;

export type TrackMomentDependencies = {
  publicBase: string;
  createOperationToken(): string;
  loadTrack(trackId: string): Promise<TrackMomentRecord | null>;
  claimPublish(input: {
    trackId: string;
    userId: string;
    operationToken: string;
    privateAudioRef: string;
  }): Promise<PublishClaim>;
  copyPrivateTrack(
    privateAudioRef: string,
    operationToken: string,
  ): Promise<TrackPromotionObject>;
  verifyPublicTrack(promotion: TrackPromotionObject): Promise<boolean>;
  finalizePublish(input: {
    trackId: string;
    userId: string;
    operationToken: string;
    publicAudioUrl: string;
    publicObjectKey: string;
  }): Promise<boolean>;
  abortPublish(input: {
    trackId: string;
    userId: string;
    operationToken: string;
  }): Promise<boolean>;
  enqueueCleanup(input: {
    trackId: string;
    userId: string;
    operationToken: string;
    publicObjectKey: string;
  }): Promise<boolean>;
  listPendingCleanup(input: {
    trackId: string;
    userId: string;
  }): Promise<TrackMomentCleanupTarget[]>;
  acknowledgeCleanup(input: {
    trackId: string;
    userId: string;
    operationToken: string;
    publicObjectKey: string;
  }): Promise<boolean>;
  deleteOwnedCleanup(target: TrackMomentCleanupTarget): Promise<void>;
  unpublish(input: { trackId: string; userId: string }): Promise<UnpublishOutcome>;
  deleteValidatedPublic(publicAudioUrl: string, publicObjectKey: string): Promise<void>;
};

export type TrackMomentResult = {
  status: number;
  body: Record<string, unknown>;
};

function error(status: number, code: string): TrackMomentResult {
  return { status, body: { error: code, code } };
}

function exactObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function success(
  trackId: string,
  visibility: "private" | "public",
  audioUrl: string,
  albumArtRef: string | null,
): TrackMomentResult {
  return {
    status: 200,
    body: {
      trackId,
      visibility,
      audioUrl,
      albumArtUrl: safePublicHttpsUrl(albumArtRef),
    },
  };
}

function publicTrackRef(value: unknown, publicBase: string): string | null {
  const parsed = parseGeneratedPublicKey(value, publicBase);
  return parsed?.kind === "track" && typeof value === "string" &&
      safePublicHttpsUrl(value)
    ? value
    : null;
}

async function safeAbort(
  deps: TrackMomentDependencies,
  trackId: string,
  userId: string,
  operationToken: string,
): Promise<boolean> {
  try {
    return await deps.abortPublish({ trackId, userId, operationToken });
  } catch {
    // The track itself is still private. A later retry can reclaim a stale claim.
    return false;
  }
}

function validCleanupTarget(
  target: TrackMomentCleanupTarget,
  publicBase: string,
): boolean {
  if (!UUID.test(target.operationToken) || typeof target.publicObjectKey !== "string") {
    return false;
  }
  const publicRef = safePublicHttpsUrl(
    `${publicBase.replace(/\/+$/, "")}/${target.publicObjectKey}`,
  );
  const owned = publicRef
    ? parseOwnedTrackPromotion(publicRef, publicBase, target.operationToken)
    : null;
  return owned?.key === target.publicObjectKey;
}

async function drainPendingCleanup(
  deps: TrackMomentDependencies,
  trackId: string,
  userId: string,
): Promise<boolean> {
  let pending: TrackMomentCleanupTarget[];
  try {
    pending = await deps.listPendingCleanup({ trackId, userId });
  } catch {
    return false;
  }
  for (const target of pending) {
    if (!validCleanupTarget(target, deps.publicBase)) return false;
    try {
      await deps.deleteOwnedCleanup(target);
    } catch {
      // The row deliberately stays pending. A later transition retries this
      // exact operation-owned key; it can never refer to a later winner.
      return false;
    }
    try {
      const acknowledged = await deps.acknowledgeCleanup({
        trackId,
        userId,
        operationToken: target.operationToken,
        publicObjectKey: target.publicObjectKey,
      });
      if (!acknowledged) return false;
    } catch {
      return false;
    }
  }
  return true;
}

async function queueAndDrainCleanup(
  deps: TrackMomentDependencies,
  trackId: string,
  userId: string,
  operationToken: string,
  publicObjectKey: string,
): Promise<boolean> {
  try {
    const queued = await deps.enqueueCleanup({
      trackId,
      userId,
      operationToken,
      publicObjectKey,
    });
    return queued && await drainPendingCleanup(deps, trackId, userId);
  } catch {
    return false;
  }
}

async function authoritativePublicSuccess(
  deps: TrackMomentDependencies,
  trackId: string,
): Promise<{ result: TrackMomentResult; audioUrl: string } | null> {
  try {
    const current = await deps.loadTrack(trackId);
    const audio = current?.isPublic
      ? publicTrackRef(current.audioRef, deps.publicBase)
      : null;
    return current && audio
      ? {
        result: success(trackId, "public", audio, current.albumArtRef),
        audioUrl: audio,
      }
      : null;
  } catch {
    return null;
  }
}

export async function handleTrackMomentRequest(
  raw: unknown,
  userId: string | null,
  deps: TrackMomentDependencies,
): Promise<TrackMomentResult> {
  if (!userId || !UUID.test(userId)) return error(401, "unauthorized");
  const body = exactObject(raw);
  if (
    !body || Object.keys(body).length !== 3 ||
    body.action !== "set_visibility" ||
    typeof body.trackId !== "string" || !UUID.test(body.trackId) ||
    (body.visibility !== "private" && body.visibility !== "public")
  ) {
    return error(400, "invalid_input");
  }
  const trackId = body.trackId;
  const visibility = body.visibility;

  let track: TrackMomentRecord | null;
  try {
    track = await deps.loadTrack(trackId);
  } catch {
    return error(503, "state_unavailable");
  }
  if (!track) return error(404, "not_found");
  if (track.ownerId !== userId) return error(403, "not_owner");
  if (!track.isAiGenerated) return error(409, "track_ineligible");
  if (!track.isReady) return error(409, "track_not_ready");

  // Drain before either direction changes visibility. This makes orphaned
  // promotion cleanup durable across retries without ever touching a winner:
  // the server validates every target against its original operation token.
  if (!(await drainPendingCleanup(deps, trackId, userId))) {
    return error(503, "cleanup_pending");
  }

  if (visibility === "private") {
    const alreadyPrivate = !track.isPublic
      ? parsePrivateMediaReference(track.audioRef, "track")
      : null;
    const publicAudio = track.isPublic
      ? publicTrackRef(track.audioRef, deps.publicBase)
      : null;
    if (!alreadyPrivate && !publicAudio) {
      return error(409, "invalid_media_reference");
    }

    let outcome: UnpublishOutcome;
    try {
      outcome = await deps.unpublish({ trackId, userId });
    } catch {
      return error(503, "state_unavailable");
    }
    if (outcome.outcome === "legacy_unsafe") {
      return error(409, "private_source_unavailable");
    }
    if (outcome.outcome === "already_private") {
      const privateSource = parsePrivateMediaReference(
        outcome.privateAudioRef,
        "track",
      );
      if (!privateSource || typeof outcome.privateAudioRef !== "string") {
        return error(503, "state_unavailable");
      }
      if (outcome.publicAudioUrl != null || outcome.publicObjectKey != null) {
        const retainedPublic = parseGeneratedPublicKey(
          outcome.publicAudioUrl,
          deps.publicBase,
        );
        if (
          !retainedPublic || retainedPublic.kind !== "track" ||
          retainedPublic.key !== outcome.publicObjectKey ||
          typeof outcome.publicAudioUrl !== "string" ||
          typeof outcome.publicObjectKey !== "string"
        ) {
          return error(503, "state_unavailable");
        }
        try {
          await deps.deleteValidatedPublic(
            outcome.publicAudioUrl,
            outcome.publicObjectKey,
          );
        } catch {
          // The track remains private; a later retry can attempt cleanup again.
        }
      } else {
        // Cancelling a publishing claim can have copied a public object before
        // finalization. The RPC has atomically queued that exact operation key;
        // try it now, but preserve a successful privacy transition if R2 is
        // temporarily unavailable so the next Moment request can retry it.
        await drainPendingCleanup(deps, trackId, userId);
      }
      return success(
        trackId,
        "private",
        outcome.privateAudioRef,
        track.albumArtRef,
      );
    }
    if (outcome.outcome !== "unpublished") {
      return outcome.outcome === "not_found"
        ? error(404, "not_found")
        : outcome.outcome === "not_owner"
        ? error(403, "not_owner")
        : error(409, "visibility_conflict");
    }
    const privateSource = parsePrivateMediaReference(outcome.privateAudioRef, "track");
    const parsedPublic = parseGeneratedPublicKey(
      outcome.publicAudioUrl,
      deps.publicBase,
    );
    if (
      !privateSource || typeof outcome.privateAudioRef !== "string" ||
      !parsedPublic || parsedPublic.kind !== "track" ||
      parsedPublic.key !== outcome.publicObjectKey ||
      !publicAudio || outcome.publicAudioUrl !== publicAudio
    ) {
      return error(503, "state_unavailable");
    }

    try {
      await deps.deleteValidatedPublic(
        outcome.publicAudioUrl as string,
        outcome.publicObjectKey as string,
      );
    } catch {
      // Visibility is already revoked; public object cleanup is best effort.
    }
    return success(trackId, "private", outcome.privateAudioRef, track.albumArtRef);
  }

  if (track.isPublic) {
    const audio = publicTrackRef(track.audioRef, deps.publicBase);
    return audio
      ? success(trackId, "public", audio, track.albumArtRef)
      : error(409, "invalid_media_reference");
  }
  const privateSource = parsePrivateMediaReference(track.audioRef, "track");
  if (!privateSource || typeof track.audioRef !== "string") {
    return error(409, "invalid_media_reference");
  }
  const operationToken = deps.createOperationToken();
  if (!UUID.test(operationToken)) return error(503, "state_unavailable");
  const expectedPublicKey = trackMomentPublicKey(track.audioRef, operationToken);
  const expectedPublicUrl = expectedPublicKey
    ? safePublicHttpsUrl(
      `${deps.publicBase.replace(/\/+$/, "")}/${expectedPublicKey}`,
    )
    : null;
  if (!expectedPublicKey || !expectedPublicUrl) {
    return error(503, "state_unavailable");
  }

  let claim: PublishClaim;
  try {
    claim = await deps.claimPublish({
      trackId,
      userId,
      operationToken,
      privateAudioRef: track.audioRef,
    });
  } catch {
    return error(503, "state_unavailable");
  }
  if (claim.outcome === "already_public") {
    return (await authoritativePublicSuccess(deps, trackId))?.result ??
      error(409, "visibility_conflict");
  }
  if (claim.outcome !== "claimed") {
    return claim.outcome === "not_found"
      ? error(404, "not_found")
      : claim.outcome === "not_owner"
      ? error(403, "not_owner")
      : error(409, "visibility_conflict");
  }

  let promotion: TrackPromotionObject;
  try {
    promotion = await deps.copyPrivateTrack(track.audioRef, operationToken);
  } catch {
    const aborted = await safeAbort(deps, trackId, userId, operationToken);
    if (aborted) {
      await drainPendingCleanup(deps, trackId, userId);
    } else {
      await queueAndDrainCleanup(
        deps,
        trackId,
        userId,
        operationToken,
        expectedPublicKey,
      );
    }
    return error(503, "promotion_failed");
  }
  const owned = parseOwnedTrackPromotion(
    promotion.publicRef,
    deps.publicBase,
    operationToken,
  );
  if (
    promotion.operationToken !== operationToken ||
    promotion.sourceKey !== privateSource.key ||
    promotion.publicKey !== expectedPublicKey ||
    promotion.publicRef !== expectedPublicUrl ||
    !owned || owned.key !== promotion.publicKey ||
    !Number.isSafeInteger(promotion.contentLength) || promotion.contentLength <= 0
  ) {
    const aborted = await safeAbort(deps, trackId, userId, operationToken);
    if (aborted) {
      await drainPendingCleanup(deps, trackId, userId);
    } else {
      await queueAndDrainCleanup(
        deps,
        trackId,
        userId,
        operationToken,
        expectedPublicKey,
      );
    }
    return error(503, "promotion_failed");
  }

  let verified = false;
  try {
    verified = await deps.verifyPublicTrack(promotion);
  } catch {
    verified = false;
  }
  if (!verified) {
    const aborted = await safeAbort(deps, trackId, userId, operationToken);
    if (aborted) {
      await drainPendingCleanup(deps, trackId, userId);
    } else {
      await queueAndDrainCleanup(
        deps,
        trackId,
        userId,
        operationToken,
        expectedPublicKey,
      );
    }
    return error(503, "promotion_failed");
  }

  let finalized = false;
  try {
    finalized = await deps.finalizePublish({
      trackId,
      userId,
      operationToken,
      publicAudioUrl: promotion.publicRef,
      publicObjectKey: promotion.publicKey,
    });
  } catch {
    finalized = false;
  }
  if (!finalized) {
    const authoritative = await authoritativePublicSuccess(deps, trackId);
    if (authoritative) {
      if (authoritative.audioUrl !== promotion.publicRef) {
        await queueAndDrainCleanup(
          deps,
          trackId,
          userId,
          operationToken,
          promotion.publicKey,
        );
      }
      return authoritative.result;
    }
    const aborted = await safeAbort(deps, trackId, userId, operationToken);
    // A thrown finalize response may mean its transaction committed. Deleting
    // is safe only when the serialized abort proves the track stayed private.
    if (aborted) {
      await drainPendingCleanup(deps, trackId, userId);
    } else {
      await queueAndDrainCleanup(
        deps,
        trackId,
        userId,
        operationToken,
        promotion.publicKey,
      );
    }
    return error(503, "finalize_failed");
  }
  return success(trackId, "public", promotion.publicRef, track.albumArtRef);
}
