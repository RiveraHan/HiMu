/**
 * Deletes a user-owned DJ: DB first (cascade removes tracks, config, jobs,
 * dj_listens), then best-effort R2 cleanup of every generated asset the DJ
 * owned. DB-first on purpose: no track ever points at deleted audio.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { keyFromPublicUrl, r2Delete } from "../_shared/r2.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { djId } = await req.json();
    if (typeof djId !== "string" || !djId) {
      return json({ error: "djId required", code: "invalid_input" }, 400);
    }

    const { data: dj } = await admin
      .from("djs")
      .select("id, owner_id, avatar_url")
      .eq("id", djId)
      .maybeSingle();

    if (!dj) return json({ error: "DJ not found", code: "not_found" }, 404);
    if (dj.owner_id !== user.id)
      return json({ error: "not your DJ", code: "not_owner" }, 403);

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
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
