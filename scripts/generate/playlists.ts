/**
 * 3 themed public playlists (one per DJ) built from the generated tracks.
 * Uses the covers from `gen:covers` (covers/playlists/<slug>.jpg).
 * Idempotent: reuses the playlist by name and re-links its tracks.
 * Requires gen:music to have run first (needs tracks).
 *
 *   npm run gen:playlists
 */
import { admin } from "./lib";

const MEDIA_BASE = (process.env.R2_PUBLIC_BASE ?? "").replace(/\/+$/, "");

const PLAYLISTS: {
  name: string;
  slug: string;
  description: string;
  djSlug: string;
}[] = [
  { name: "Deep Focus", slug: "deep-focus", description: "Lo-fi & ambient for deep work", djSlug: "nova" },
  { name: "Night Drive", slug: "night-drive", description: "Driving techno for the dark hours", djSlug: "axon" },
  { name: "Forest Sleep", slug: "forest-sleep", description: "Nature & meditation to drift off", djSlug: "sage" },
];

async function main() {
  for (const pl of PLAYLISTS) {
    const { data: dj } = await admin
      .from("djs")
      .select("id")
      .eq("slug", pl.djSlug)
      .single();
    if (!dj) {
      console.log(`↷ skip ${pl.name}: DJ ${pl.djSlug} not found`);
      continue;
    }

    const { data: tracks } = await admin
      .from("tracks")
      .select("id")
      .eq("dj_id", dj.id)
      .like("audio_url", `${MEDIA_BASE}/%`) // only real R2 tracks, never placeholders
      .order("created_at", { ascending: true });
    if (!tracks?.length) {
      console.log(`↷ skip ${pl.name}: ${pl.djSlug} has no real tracks (run gen:music)`);
      continue;
    }

    const coverUrl = `${MEDIA_BASE}/covers/playlists/${pl.slug}.jpg`;

    const { data: existing } = await admin
      .from("playlists")
      .select("id")
      .eq("name", pl.name)
      .eq("is_public", true)
      .maybeSingle();

    let playlistId: string;
    if (existing) {
      playlistId = existing.id;
      await admin
        .from("playlists")
        .update({ description: pl.description, cover_url: coverUrl })
        .eq("id", playlistId);
    } else {
      const { data: created, error } = await admin
        .from("playlists")
        .insert({
          name: pl.name,
          description: pl.description,
          cover_url: coverUrl,
          is_public: true,
          user_id: null, // playlists.user_id is nullable
        })
        .select("id")
        .single();
      if (error) throw error;
      playlistId = created.id;
    }

    // Re-link tracks (idempotent)
    await admin.from("playlist_tracks").delete().eq("playlist_id", playlistId);
    const rows = tracks.map((t, i) => ({
      playlist_id: playlistId,
      track_id: t.id,
      position: i + 1,
    }));
    const { error: linkErr } = await admin.from("playlist_tracks").insert(rows);
    if (linkErr) throw linkErr;

    console.log(`✓ ${pl.name} — ${tracks.length} tracks`);
  }
  console.log("\nPlaylists done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
