/**
 * Updates a user-owned DJ and optionally regenerates its portrait.
 * The new base_prompt only affects future generations; existing tracks are never touched.
 */

import {
  buildAvatarPrompt,
  buildBasePrompt,
  validateDjInput,
} from "../_shared/dj-input.ts";
import { invalid, json } from "../_shared/http.ts";
import { keyFromPublicUrl, r2Delete, r2Put } from "../_shared/r2.ts";
import { replicateRun } from "../_shared/replicate.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";

const DAILY_AVATAR_REGENS = 3;

// e.g avatars/generated/{djId}.jpg → 0 · avatars/generated/{djId}-{n}.jpg → n
function avatarVersion(url: string | null, djId: string): number {
  const m = url?.match(new RegExp(`${djId}-(\\d+)\\.jpg$`));
  return m ? Number(m[1]) : 0;
}

serveAuthed(async (req, user) => {
  const body = (await req.json()) as Record<string, unknown>;

  const djId = body.djId;
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

  const v = validateDjInput(body);
  if (!v.ok) return invalid(v.error);

  const { name, genres, moods, energy, isInstrumental, vibe } = v.data;
  const regen = body.regenerateAvatar === true;

  if (regen) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count } = await admin
      .from("avatar_regens")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gt("created_at", dayAgo);

    if ((count ?? 0) >= DAILY_AVATAR_REGENS) {
      return json(
        {
          error: `daily limit of ${DAILY_AVATAR_REGENS} portraits reached`,
          code: "avatar_quota_reached",
        },
        429,
      );
    }
  }

  // Save traits (slug untouched: stable identity and URLs).
  const { error: djErr } = await admin
    .from("djs")
    .update({
      name,
      character: vibe,
      genre_specialties: genres,
      mood_tags: moods,
      personality_traits: { energy, vibe, isInstrumental },
    })
    .eq("id", djId);

  if (djErr) throw djErr;

  const { error: cfgErr } = await admin
    .from("dj_generation_configs")
    .update({
      base_prompt: buildBasePrompt(v.data),
      is_instrumental: isInstrumental,
      updated_at: new Date().toISOString(),
    })
    .eq("dj_id", djId);

  if (cfgErr) throw cfgErr;

  // Optional portrait regen — the traits above stay saved even if it fails.
  let avatarUrl: string | null = null;

  if (regen) {
    const next = avatarVersion(dj.avatar_url, djId) + 1;
    const newKey = `avatars/generated/${djId}-${next}.jpg`;

    try {
      const tmp = await replicateRun(
        "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions",
        {
          input: {
            prompt: buildAvatarPrompt(genres, moods),
            aspect_ratio: "1:1",
            output_format: "jpg",
            safety_tolerance: 5,
          },
        },
      );

      const bytes = new Uint8Array(await (await fetch(tmp)).arrayBuffer());
      avatarUrl = await r2Put(newKey, bytes, "image/jpeg");

      const { error: avErr } = await admin
        .from("djs")
        .update({ avatar_url: avatarUrl })
        .eq("id", djId);
      if (avErr) throw avErr;

      // Exactly one live portrait per DJ: drop the previous one.
      const oldKey = dj.avatar_url ? keyFromPublicUrl(dj.avatar_url) : null;
      if (oldKey) await r2Delete([oldKey]);

      await admin
        .from("avatar_regens")
        .insert({ user_id: user.id, dj_id: djId });
    } catch (e) {
      console.error("[update-dj] portrait regen failed:", e);
      await r2Delete([newKey]); // no orphans if we uploaded before failing
      avatarUrl = null;
    }
  }

  return json({ djId, avatarUrl });
});
