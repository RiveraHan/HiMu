/**
 * Deletes a user-owned DJ: DB first (cascade removes tracks, config, jobs,
 * dj_listens), then best-effort R2 cleanup of every generated asset the DJ
 * owned. DB-first on purpose: no track ever points at deleted audio.
 */

import { invalid, json } from "../_shared/http.ts";
import { keyFromStoredMedia, r2Delete } from "../_shared/r2.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";

serveAuthed(async (req, user) => {
  const { djId } = await req.json();
  if (typeof djId !== "string" || !djId) return invalid("djId required");

  const { data: dj } = await admin
    .from("djs")
    .select("id, owner_id, avatar_url")
    .eq("id", djId)
    .maybeSingle();

  if (!dj) return json({ error: "DJ not found", code: "not_found" }, 404);
  if (dj.owner_id !== user.id) {
    return json({ error: "not your DJ", code: "not_owner" }, 403);
  }

  // Collect R2 keys BEFORE the rows disappear. Stored-media parsing accepts
  // only our generated public URLs or validated private references, and each
  // Set dedupes repeated assets.
  const { data: tracks } = await admin
    .from("tracks")
    .select("audio_url, album_art_url")
    .eq("dj_id", djId);

  const { data: jobs } = await admin
    .from("generation_jobs")
    .select("caption_audio_url")
    .eq("dj_id", djId);

  const publicKeys = new Set<string>();
  const privateKeys = new Set<string>();

  const urls = [
    dj.avatar_url,
    ...(tracks ?? []).flatMap((t) => [t.audio_url, t.album_art_url]),
    ...(jobs ?? []).map((job) => job.caption_audio_url),
  ];

  for (const url of urls) {
    const stored = url ? keyFromStoredMedia(url) : null;
    if (stored?.access === "private") privateKeys.add(stored.key);
    if (stored?.access === "public") publicKeys.add(stored.key);
  }

  // DB first (cascade), then storage.
  const { error: delErr } = await admin.from("djs").delete().eq("id", djId);
  if (delErr) throw delErr;

  await Promise.all([
    r2Delete([...publicKeys], "public"),
    r2Delete([...privateKeys], "private"),
  ]);

  return json({ ok: true });
});
