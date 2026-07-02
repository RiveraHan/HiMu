/**
 * Placeholder cleanup (§4.6). ⚠️ DESTRUCTIVE.
 * Run AFTER gen:music (otherwise the app is left with no tracks).
 * Correct order:  gen:music → gen:cleanup → gen:playlists
 *
 * Deletes:
 *  - SoundHelix tracks (old sample audio) + their playlist links
 *  - placeholder playlists with picsum covers + their links
 *
 *   npm run gen:cleanup
 */
import { admin } from "./lib";

async function main() {
  // 1. SoundHelix (fake) tracks — remove their playlist_tracks first (FK)
  const { data: fakeTracks } = await admin
    .from("tracks")
    .select("id")
    .like("audio_url", "%soundhelix%");
  const fakeIds = (fakeTracks ?? []).map((t) => t.id);
  if (fakeIds.length) {
    await admin.from("playlist_tracks").delete().in("track_id", fakeIds);
    const { error } = await admin.from("tracks").delete().in("id", fakeIds);
    if (error) throw error;
  }
  console.log(`✓ SoundHelix tracks deleted: ${fakeIds.length}`);

  // 2. Placeholder playlists (picsum cover) — remove their links first
  const { data: fakePl } = await admin
    .from("playlists")
    .select("id")
    .like("cover_url", "%picsum%");
  const plIds = (fakePl ?? []).map((p) => p.id);
  if (plIds.length) {
    await admin.from("playlist_tracks").delete().in("playlist_id", plIds);
    const { error } = await admin.from("playlists").delete().in("id", plIds);
    if (error) throw error;
  }
  console.log(`✓ placeholder playlists deleted: ${plIds.length}`);

  console.log("\nCleanup done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
