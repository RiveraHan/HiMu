/**
 * Regenerate the cover of a track that belongs to one of the user's DJs.
 * Synchronous: generates a fresh cover, swaps tracks.album_art_url, records the
 * regen for quota, and deletes the previous cover. Counted against the shared
 * daily generation quota.
 */
import { generateCoverImage } from "../_shared/cover.ts";
import { invalid, json } from "../_shared/http.ts";
import {
  countDailyGenerations,
  DAILY_GENERATION_LIMIT,
} from "../_shared/quota.ts";
import { keyFromPublicUrl, r2Delete } from "../_shared/r2.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";

serveAuthed(async (req, user) => {
  const { trackId } = await req.json();
  if (!trackId) return invalid("trackId required");

  const { data: track } = await admin
    .from("tracks")
    .select("id, genre, mood_tags, album_art_url, dj_id, djs(owner_id)")
    .eq("id", trackId)
    .single();

  if (!track) return json({ error: "track not found" }, 404);

  // Authorization: only tracks from your own DJs.
  const owner: string | null = (track.djs as any)?.owner_id ?? null;
  if (owner !== user.id) {
    return json(
      { error: "you can't regenerate this cover", code: "track_not_allowed" },
      403,
    );
  }

  // Shared daily quota (mixes + cover regens).
  if ((await countDailyGenerations(user.id)) >= DAILY_GENERATION_LIMIT) {
    return json(
      {
        error: `daily limit of ${DAILY_GENERATION_LIMIT} generations reached`,
        code: "daily_quota_reached",
      },
      429,
    );
  }

  const key = `covers/generated/${trackId}-${Date.now()}.jpg`;
  const url = await generateCoverImage(
    key,
    (track as any).genre ?? "",
    (track as any).mood_tags?.[0] ?? "",
  );

  const { error: upErr } = await admin
    .from("tracks")
    .update({ album_art_url: url })
    .eq("id", trackId);
  if (upErr) throw upErr;

  // Record the regen (consumes quota).
  await admin
    .from("cover_regens")
    .insert({ user_id: user.id, track_id: trackId });

  // Best-effort: remove the previous cover (only if it's one of our generated keys).
  const oldKey = (track as any).album_art_url
    ? keyFromPublicUrl((track as any).album_art_url)
    : null;
  if (oldKey) await r2Delete([oldKey]);

  return json({ album_art_url: url });
});
