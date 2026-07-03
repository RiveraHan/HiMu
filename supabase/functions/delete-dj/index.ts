/**
 * Deletes a user-owned DJ: DB first (cascade removes tracks, config, jobs,
 * dj_listens), then best-effort R2 cleanup of every generated asset the DJ
 * owned. DB-first on purpose: no track ever points at deleted audio.
 */

import { invalid, json } from "../_shared/http.ts";
import { keyFromPublicUrl, r2Delete } from "../_shared/r2.ts";
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

  // Collect R2 keys BEFORE the rows disappear. keyFromPublicUrl filters to
  // our own */generated/ assets and returns null for anything else, and the
  // Set dedupes (a cover can be the avatar fallback).
  const { data: tracks } = await admin
    .from("tracks")
    .select("audio_url, album_art_url")
    .eq("dj_id", djId);

  const keys = new Set<string>();

  const urls = [
    dj.avatar_url,
    ...(tracks ?? []).flatMap((t) => [t.audio_url, t.album_art_url]),
  ];

  for (const url of urls) {
    const key = url ? keyFromPublicUrl(url) : null;

    if (key) keys.add(key);
  }

  // DB first (cascade), then storage.
  const { error: delErr } = await admin.from("djs").delete().eq("id", djId);
  if (delErr) throw delErr;

  await r2Delete([...keys]);

  return json({ ok: true });
});
