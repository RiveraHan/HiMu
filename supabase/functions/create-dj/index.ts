/**
 * Creates a user-owned DJ: validates wizard input, enforces the DJ quota,
 * builds the generation config server-side.
 * The DJ is created even if the avatar fails (client falls back to initials).
 */

import {
  buildAvatarPrompt,
  buildBasePrompt,
  buildDjIdentityFields,
  parseIsPublic,
  validateDjInput,
} from "../_shared/dj-input.ts";
import { invalid, json } from "../_shared/http.ts";
import { mapProviderReservation } from "../_shared/provider-usage.ts";
import { r2Delete, r2Put } from "../_shared/r2.ts";
import { replicateRun } from "../_shared/replicate.ts";
import { serveAuthed } from "../_shared/serve.ts";
import { admin } from "../_shared/supabase.ts";
import {
  isDjQuotaError,
  MAX_OWNED_DJS,
} from "./create-dj-contract.ts";
import { runAvatarGeneration } from "../update-dj/avatar-reservation.ts";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

serveAuthed(async (req, user) => {
  const body = await req.json();
  const v = validateDjInput(body);
  if (!v.ok) return invalid(v.error);

  let isPublic: boolean;
  try {
    isPublic = parseIsPublic((body as Record<string, unknown>).isPublic);
  } catch (error) {
    return invalid(error instanceof Error ? error.message : "invalid input");
  }

  const {
    name,
    identityConcept,
    genres,
    moods,
    energy,
    isInstrumental,
  } = v.data;

  // Quota check
  const { count, error: countError } = await admin
    .from("djs")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  if (countError) throw countError;

  if ((count ?? 0) >= MAX_OWNED_DJS) {
    return json(
      {
        error: `you already have ${MAX_OWNED_DJS} DJ`,
        code: "dj_quota_reached",
        limit: MAX_OWNED_DJS,
      },
      403,
    );
  }

  const basePrompt = buildBasePrompt(v.data);

  let dj: { id: string } | null = null;

  for (let attempt = 0; attempt < 2 && !dj; attempt++) {
    const slug = `${slugify(name)}-${crypto.randomUUID().slice(0, 4)}`;

    const { data, error } = await admin
      .from("djs")
      .insert({
        name,
        slug,
        owner_id: user.id,
        is_public: isPublic,
        ...buildDjIdentityFields(v.data),
        genre_specialties: genres,
        mood_tags: moods,
        personality_traits: { energy, vibe, isInstrumental },
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505" && attempt === 0) continue; // slug collision
      if (isDjQuotaError(error)) {
        return json(
          {
            error: `you already have ${MAX_OWNED_DJS} DJ`,
            code: "dj_quota_reached",
            limit: MAX_OWNED_DJS,
          },
          403,
        );
      }
      throw error;
    }

    dj = data;
  }

  if (!dj) throw new Error("could not insert dj");

  // From here on, roll back on failure so no half-created DJ survives.
  try {
    const { error: cfgErr } = await admin.from("dj_generation_configs").insert({
      dj_id: dj.id,
      base_prompt: basePrompt,
      is_instrumental: isInstrumental,
      max_duration: 120,
    });

    if (cfgErr) throw cfgErr;

    let avatarReady = false;

    try {
      const avatar = await runAvatarGeneration({
        userId: user.id,
        operation: "initial_avatar",
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
          const url = await replicateRun(
            "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions",
            {
              input: {
                prompt: buildAvatarPrompt(genres, moods, identityConcept),
                aspect_ratio: "1:1",
                output_format: "jpg",
                safety_tolerance: 5,
              },
            },
          );

          const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());

          const publicUrl = await r2Put(
            `avatars/generated/${dj.id}.jpg`,
            bytes,
            "image/jpeg",
            "public",
          );

          await admin.from("djs").update({ avatar_url: publicUrl }).eq("id", dj.id);
          return publicUrl;
        },
      });

      avatarReady = avatar.outcome === "generated";
    } catch (e) {
      console.error("[create-dj] avatar failed:", e);
    }

    return json({ djId: dj.id, avatarReady });
  } catch (e) {
    // Rollback: no orphaned rows or files on failure.
    await r2Delete([`avatars/generated/${dj.id}.jpg`], "public");
    await admin.from("djs").delete().eq("id", dj.id); // cascade removes config
    throw e;
  }
});
