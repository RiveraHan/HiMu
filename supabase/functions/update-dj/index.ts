/**
 * Updates a user-owned DJ and optionally regenerates its portrait.
 * The new base_prompt only affects future generations; existing tracks are never touched.
 */

import {
  buildBasePrompt,
  validateDjTraitsInput,
} from "../_shared/dj-input.ts";
import { generateAvatarImage } from "../_shared/avatar.ts";
import { invalid, json } from "../_shared/http.ts";
import { mapProviderReservation } from "../_shared/provider-usage.ts";
import { keyFromPublicUrl, r2Delete } from "../_shared/r2.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";
import { runAvatarGeneration } from "./avatar-reservation.ts";

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
    .select("id, owner_id, avatar_url, identity_concept")
    .eq("id", djId)
    .maybeSingle();

  if (!dj) return json({ error: "DJ not found", code: "not_found" }, 404);

  if (dj.owner_id !== user.id) {
    return json({ error: "not your DJ", code: "not_owner" }, 403);
  }

  const v = validateDjTraitsInput(body);
  if (!v.ok) return invalid(v.error);

  const { name, genres, moods, energy, isInstrumental, vibe } = v.data;
  const regen = body.regenerateAvatar === true;

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
      base_prompt: buildBasePrompt({
        ...v.data,
        identityConcept: dj.identity_concept,
      }),
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
      const avatar = await runAvatarGeneration({
        userId: user.id,
        operation: "avatar_regen",
        requestId: crypto.randomUUID(),
      }, {
        reserve: async ({ userId, operation, requestId }) => {
          const { data, error } = await admin.rpc("reserve_avatar_generation", {
            p_user_id: userId,
            p_operation: operation,
            p_request_id: requestId,
          });
          return mapProviderReservation(data, error);
        },
        generate: async () => {
          const nextAvatarUrl = await generateAvatarImage(newKey, {
            genres,
            moods,
            identityConcept: dj.identity_concept,
            seed: `${djId}:${next}:avatar-v2`,
          });

          const { error: avErr } = await admin
            .from("djs")
            .update({ avatar_url: nextAvatarUrl })
            .eq("id", djId);
          if (avErr) throw avErr;

          // Exactly one live portrait per DJ: drop the previous one.
          const oldKey = dj.avatar_url ? keyFromPublicUrl(dj.avatar_url) : null;
          if (oldKey) await r2Delete([oldKey], "public");

          await admin
            .from("avatar_regens")
            .insert({ user_id: user.id, dj_id: djId });

          return nextAvatarUrl;
        },
      });

      if (avatar.outcome === "quota") {
        return json(
          {
            error: `daily limit of ${avatar.limit} portraits reached`,
            code: "avatar_quota_reached",
          },
          429,
        );
      }
      avatarUrl = avatar.value;
    } catch (e) {
      console.error("[update-dj] portrait regen failed:", e);
      await r2Delete([newKey], "public"); // no orphans if we uploaded before failing
      avatarUrl = null;
    }
  }

  return json({ djId, avatarUrl });
});
